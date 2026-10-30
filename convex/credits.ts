import { v } from "convex/values";
import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { deny, permitsUnit, requireAccess } from "./lib/authorization";
import { caseAccess } from "./lib/caseAccess";
import { operation } from "./lib/operations";
import { canonicalJson, code, date, invalid, text } from "./lib/contracts";
import { paise, quantity, sumPaise } from "./lib/exact";
import { activeCreditLines, matchCaseCredits } from "./lib/creditMatching";
import { activeReturnLines, activeSource } from "./lib/businessSources";
import { businessAudit } from "./lib/businessAudit";
import { internalActor } from "./lib/internalActor";
import { jobAccess } from "./lib/intakeAccess";
import { discrepancy } from "./lib/discrepancy";
import type { NormalizedRow } from "./lib/normalizeRow";

const quantityFields = v.array(v.object({ returnLineId: v.id("returnLines"), quantity: v.string() }));
async function confirmHeader(ctx: MutationCtx, note: Doc<"creditNotes">, actor: Id<"users">, totalPaise: number, reason: string) {
  paise(totalPaise); if (totalPaise < 0) return invalid("NEGATIVE_CREDIT_TOTAL");
  const lines = await activeCreditLines(ctx, await ctx.db.query("creditNoteLines").withIndex("by_note", (q) => q.eq("noteId", note._id)).collect());
  if (lines.length > 1000 || lines.some((l) => l.matchRequired)) return invalid("CONFIRM_CREDIT_LINE_MATCHES_FIRST");
  const allocated = sumPaise(lines.map((l) => l.amountPaise)); if (allocated > totalPaise) return invalid("TOTAL_BELOW_ALLOCATED_CREDIT");
  const previous = note.latestConfirmationId ? await ctx.db.get(note.latestConfirmationId) : null; const lineIds = lines.map((l) => l._id).sort();
  if (previous?.totalPaise === totalPaise && canonicalJson(previous.lineIds.slice().sort()) === canonicalJson(lineIds)) return previous._id;
  const id = await ctx.db.insert("creditNoteConfirmations", { organizationId: note.organizationId, operationalUnitId: note.operationalUnitId, distributorId: note.distributorId, noteId: note._id, totalPaise, lineIds, actorUserId: actor, reason, createdAt: Date.now() });
  await ctx.db.patch(note._id, { latestConfirmationId: id, confirmedTotalPaise: totalPaise });
  await discrepancy(ctx, note, actor, "finance", "credit_note", note._id, "UNALLOCATED_ISSUED_CREDIT", totalPaise > allocated, sumPaise([totalPaise, -allocated]));
  await businessAudit(ctx, note.organizationId, actor, "credit_note", note._id, "credit.issue_confirmed", reason, { before: { confirmationId: note.latestConfirmationId }, after: { confirmationId: id, totalPaise, lineIds } });
  await ctx.scheduler.runAfter(0, internal.credits.matchNote, { noteId: note._id, actorUserId: actor, cursor: 0 }); return id;
}
async function validatedQuantities(ctx: MutationCtx, caseId: Id<"returnCases">, inputs: { returnLineId: Id<"returnLines">; quantity: string }[]) {
  const lines = await activeReturnLines(ctx, caseId); const seen = new Set<string>(); const result = [];
  if (inputs.length > 100) return invalid("CREDIT_LINE_LIMIT");
  for (const input of inputs) { if (!lines.some((l) => l._id === input.returnLineId) || seen.has(input.returnLineId)) return invalid("INVALID_CREDIT_QUANTITY_LINE"); seen.add(input.returnLineId); result.push({ returnLineId: input.returnLineId, quantity: quantity(input.quantity) }); } return result;
}

export const record = mutation({
  args: { caseId: v.id("returnCases"), number: v.string(), issuedDate: v.string(), noteTotalPaise: v.number(), allocatedPaise: v.number(), quantities: quantityFields, issuedConfirmed: v.boolean(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await caseAccess(ctx, args.caseId, "credit"); const reason = text(args.reason, 1000); if (!args.issuedConfirmed || reason.length < 3) return invalid("ACTUAL_ISSUANCE_CONFIRMATION_REQUIRED");
    const decision = actor.item.latestDecisionId ? await ctx.db.get(actor.item.latestDecisionId) : null; if (decision?.outcome !== "approved") return invalid("APPROVAL_REQUIRED");
    const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "record_credit", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    const number = code(args.number); date(args.issuedDate); paise(args.allocatedPaise); if (args.allocatedPaise < 0) return invalid("NEGATIVE_CREDIT");
    let note = await ctx.db.query("creditNotes").withIndex("by_number", (q) => q.eq("organizationId", actor.item.organizationId).eq("operationalUnitId", actor.item.operationalUnitId!).eq("distributorId", actor.item.distributorId).eq("number", number)).unique();
    if (note && note.issuedDate !== args.issuedDate) return invalid("CREDIT_NOTE_DATE_CONFLICT");
    if (!note) { const id = await ctx.db.insert("creditNotes", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, number, issuedDate: args.issuedDate, source: "manual", createdBy: actor.user._id, createdAt: Date.now() }); note = await ctx.db.get(id); }
    if (!note) return deny(); const quantities = await validatedQuantities(ctx, args.caseId, args.quantities);
    const existing = (await activeCreditLines(ctx, await ctx.db.query("creditNoteLines").withIndex("by_note", (q) => q.eq("noteId", note!._id)).collect())).filter((l) => l.caseId === args.caseId);
    if (existing.length) { if (existing.length === 1 && !existing[0].sourceRowId && existing[0].amountPaise === args.allocatedPaise && canonicalJson(existing[0].quantities) === canonicalJson(quantities)) { await confirmHeader(ctx, note, actor.user._id, args.noteTotalPaise, reason); return op.complete(note._id); } return invalid("REVIEW_EXISTING_CREDIT_ALLOCATION"); }
    await ctx.db.insert("creditNoteLines", { organizationId: note.organizationId, operationalUnitId: note.operationalUnitId, distributorId: note.distributorId, noteId: note._id, caseId: args.caseId, amountPaise: args.allocatedPaise, quantities, matchRequired: false, actorUserId: actor.user._id, reason, createdAt: Date.now() });
    await confirmHeader(ctx, note, actor.user._id, args.noteTotalPaise, reason); return op.complete(note._id);
  },
});
export const confirmNoteTotal = mutation({
  args: { noteId: v.id("creditNotes"), totalPaise: v.number(), issuedConfirmed: v.boolean(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => { const note = await ctx.db.get(args.noteId); if (!note) return deny(); const actor = await requireAccess(ctx, note, "credit"); const reason = text(args.reason, 1000); if (!args.issuedConfirmed || reason.length < 3) return invalid("ACTUAL_ISSUANCE_CONFIRMATION_REQUIRED"); const op = await operation(ctx, note.organizationId, actor.user._id, args.idempotencyKey, { action: "confirm_note", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId; return op.complete(await confirmHeader(ctx, note, actor.user._id, args.totalPaise, reason)); },
});
export const correctAllocation = mutation({
  args: { lineId: v.id("creditNoteLines"), caseId: v.id("returnCases"), amountPaise: v.number(), quantities: quantityFields, reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const old = await ctx.db.get(args.lineId); if (!old) return deny(); const actor = await requireAccess(ctx, old, "credit"); const target = await caseAccess(ctx, args.caseId, "credit"); if (target.item.organizationId !== old.organizationId || target.item.operationalUnitId !== old.operationalUnitId || target.item.distributorId !== old.distributorId) return deny(); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED"); const op = await operation(ctx, old.organizationId, actor.user._id, args.idempotencyKey, { action: "correct_credit_allocation", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    if (await ctx.db.query("creditNoteLines").withIndex("by_superseded", (q) => q.eq("supersedesId", old._id)).first()) return invalid("ALLOCATION_ALREADY_SUPERSEDED"); paise(args.amountPaise); if (args.amountPaise < 0) return invalid("NEGATIVE_CREDIT");
    const id = await ctx.db.insert("creditNoteLines", { organizationId: old.organizationId, operationalUnitId: old.operationalUnitId, distributorId: old.distributorId, noteId: old.noteId, caseId: args.caseId, amountPaise: args.amountPaise, quantities: await validatedQuantities(ctx, args.caseId, args.quantities), matchRequired: false, supersedesId: old._id, sourceRowId: old.sourceRowId, actorUserId: actor.user._id, reason, createdAt: Date.now() });
    await businessAudit(ctx, old.organizationId, actor.user._id, "credit_note", old.noteId, "credit.allocation_corrected", reason, { before: { allocationId: old._id }, after: { allocationId: id, awaitingHeaderConfirmation: true } }); await matchCaseCredits(ctx, old.caseId, actor.user._id); if (old.caseId !== args.caseId) await matchCaseCredits(ctx, args.caseId, actor.user._id); return op.complete(id);
  },
});
export const list = query({
  args: { organizationId: v.id("organizations"), operationalUnitId: v.optional(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")) },
  handler: async (ctx, args) => { const actor = await requireAccess(ctx, args, "reports"); const units = (await ctx.db.query("operationalUnits").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((u) => u.active && permitsUnit(actor.membership, u._id) && (!args.operationalUnitId || u._id === args.operationalUnitId)); if (!units.length) return []; const notes = await ctx.db.query("creditNotes").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(...units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), args.distributorId ? q.eq(q.field("distributorId"), args.distributorId) : q.eq(true, true))).order("desc").take(1000); const result = []; for (const note of notes) { const distributor = await ctx.db.get(note.distributorId); if (!distributor?.active) continue; const all = await ctx.db.query("creditNoteLines").withIndex("by_note", (q) => q.eq("noteId", note._id)).collect(); const active = await activeCreditLines(ctx, all); const confirmation = note.latestConfirmationId ? await ctx.db.get(note.latestConfirmationId) : null; const allocations = []; for (const line of active) { const item = await ctx.db.get(line.caseId); allocations.push({ ...line, caseReference: item?.caseReference ?? "Unlinked return" }); } result.push({ note, distributorName: distributor.name, allocations, allocatedPaise: sumPaise(active.map((l) => l.amountPaise)), pending: !confirmation || active.some((l) => l.matchRequired || !confirmation.lineIds.includes(l._id)) || confirmation.lineIds.some((id) => !active.some((l) => l._id === id)) }); } return result; },
});

export const projectSubmission = internalMutation({
  args: { submissionId: v.id("submissions"), actorUserId: v.id("users"), cursor: v.number() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || s.evidenceType !== "issued_credit_notes") return { done: true, cursor: args.cursor }; await jobAccess(ctx, { ...s, submittedBy: args.actorUserId });
    const rows = await ctx.db.query("confirmedRows").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect();
    for (const row of rows.slice(args.cursor, args.cursor + 20)) {
      if (!await activeSource(ctx, row) || await ctx.db.query("creditNoteLines").withIndex("by_source", (q) => q.eq("sourceRowId", row._id)).first()) continue;
      const data = JSON.parse(row.normalizedJson) as NormalizedRow; const value = data.values; const scope = { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: data.distributorId };
      const item = await ctx.db.query("returnCases").withIndex("by_case_reference", (q) => q.eq("organizationId", s.organizationId).eq("caseReference", value.case_reference)).unique();
      if (!item || item.operationalUnitId !== s.operationalUnitId || item.distributorId !== data.distributorId) { await discrepancy(ctx, scope, args.actorUserId, "finance", "confirmed_row", row._id, "UNMATCHED_CREDIT_CASE", true, data.amountPaise); continue; }
      let note = await ctx.db.query("creditNotes").withIndex("by_number", (q) => q.eq("organizationId", s.organizationId).eq("operationalUnitId", s.operationalUnitId).eq("distributorId", data.distributorId).eq("number", value.credit_note_number)).unique();
      if (note && note.issuedDate !== value.credit_date) { await discrepancy(ctx, scope, args.actorUserId, "finance", "confirmed_row", row._id, "CREDIT_NOTE_DATE_CONFLICT", true, data.amountPaise); continue; }
      if (!note) { const id = await ctx.db.insert("creditNotes", { ...scope, number: value.credit_note_number, issuedDate: value.credit_date, source: "import", createdBy: args.actorUserId, createdAt: Date.now() }); note = await ctx.db.get(id); } if (!note) return deny();
      const candidates = (await activeReturnLines(ctx, item._id)).filter((l) => l.productId === data.productId && (!value.batch_number || l.batchNumber === value.batch_number));
      const old = row.supersedesId ? await ctx.db.query("creditNoteLines").withIndex("by_source", (q) => q.eq("sourceRowId", row.supersedesId)).order("desc").first() : null;
      const id = await ctx.db.insert("creditNoteLines", { ...scope, noteId: note._id, caseId: item._id, amountPaise: paise(data.amountPaise!), quantities: candidates.length === 1 ? [{ returnLineId: candidates[0]._id, quantity: quantity(value.quantity) }] : [], matchRequired: candidates.length !== 1, supersedesId: old?._id, sourceRowId: row._id, actorUserId: args.actorUserId, reason: "Confirmed credit import; issued total still requires Finance confirmation", createdAt: Date.now() });
      await businessAudit(ctx, s.organizationId, args.actorUserId, "credit_note", note._id, "credit.import_recorded", "Imported allocation retained; no header total or issuance confirmation was inferred", { before: null, after: { allocationId: id } });
      await discrepancy(ctx, scope, args.actorUserId, "finance", "confirmed_row", row._id, "UNMATCHED_CREDIT_CASE", false); await matchCaseCredits(ctx, item._id, args.actorUserId);
    }
    const cursor = args.cursor + 20; return { done: cursor >= rows.length, cursor };
  },
});
export const matchNote = internalMutation({
  args: { noteId: v.id("creditNotes"), actorUserId: v.id("users"), cursor: v.number() },
  handler: async (ctx, args) => { const note = await ctx.db.get(args.noteId); if (!note) return; await internalActor(ctx, note, args.actorUserId, "credit"); const lines = await ctx.db.query("creditNoteLines").withIndex("by_note", (q) => q.eq("noteId", note._id)).collect(); const ids = [...new Set(lines.map((l) => l.caseId))]; const id = ids[args.cursor]; if (id) await matchCaseCredits(ctx, id, args.actorUserId); if (args.cursor + 1 < ids.length) await ctx.scheduler.runAfter(0, internal.credits.matchNote, { ...args, cursor: args.cursor + 1 }); },
});
