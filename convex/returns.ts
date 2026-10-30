import { v } from "convex/values";
import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deny } from "./lib/authorization";
import { caseAccess } from "./lib/caseAccess";
import { can } from "./lib/permissions";
import { activeReceipts, activeReturnLines, activeSource, manufacturerSales } from "./lib/businessSources";
import { businessAudit } from "./lib/businessAudit";
import { calculateReturn, type ReturnCalculation } from "./lib/returnCalculation";
import { operation } from "./lib/operations";
import { canonicalJson, code, date, fingerprint, invalid, text } from "./lib/contracts";
import { decimal, lineAmounts, quantity, sumPaise } from "./lib/exact";
import { addDays, businessDate } from "./lib/calendar";
import { jobAccess } from "./lib/intakeAccess";
import type { NormalizedRow } from "./lib/normalizeRow";
import { matchCaseCredits } from "./lib/creditMatching";
import { readScope } from "./lib/readScope";
import { discrepancy } from "./lib/discrepancy";

export const projectSubmission = internalMutation({
  args: { submissionId: v.id("submissions"), actorUserId: v.id("users"), cursor: v.number() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || s.evidenceType !== "distributor_return_claim") return { done: true, cursor: args.cursor };
    await jobAccess(ctx, { ...s, submittedBy: args.actorUserId });
    const rows = await ctx.db.query("confirmedRows").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect();
    for (const row of rows.slice(args.cursor, args.cursor + 30)) {
      if (!await activeSource(ctx, row) || await ctx.db.query("returnLines").withIndex("by_source", (q) => q.eq("sourceRowId", row._id)).unique()) continue;
      const data = JSON.parse(row.normalizedJson) as NormalizedRow; const value = data.values;
      const key = fingerprint("return_case", { organization: s.organizationId, unit: s.operationalUnitId, distributor: data.distributorId, reference: value.return_reference });
      let item = await ctx.db.query("returnCases").withIndex("by_fingerprint", (q) => q.eq("organizationId", s.organizationId).eq("fingerprint", key)).unique();
      if (!item) {
        const counter = await ctx.db.query("sequences").withIndex("by_kind", (q) => q.eq("organizationId", s.organizationId).eq("kind", "return_case")).unique(); const next = (counter?.value ?? 0) + 1; if (!Number.isSafeInteger(next)) return invalid("SEQUENCE_LIMIT");
        if (counter) await ctx.db.patch(counter._id, { value: next }); else await ctx.db.insert("sequences", { organizationId: s.organizationId, kind: "return_case", value: next });
        const id = await ctx.db.insert("returnCases", { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: data.distributorId, submissionId: s._id, caseReference: `RET-${String(next).padStart(6, "0")}`, distributorReference: value.return_reference, returnDate: value.return_date, fingerprint: key, status: "submitted", issuedCreditAmountPaise: 0, createdAt: Date.now(), updatedAt: Date.now() }); item = await ctx.db.get(id);
      }
      if (!item) return deny();
      if (item.returnDate && item.returnDate !== value.return_date) { await discrepancy(ctx, { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: data.distributorId }, args.actorUserId, "data", "confirmed_row", row._id, "RETURN_REFERENCE_DATE_CONFLICT", true); continue; }
      if ((await activeReturnLines(ctx, item._id)).length >= 100) return invalid("CASE_LINE_LIMIT");
      await ctx.db.insert("returnLines", { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: data.distributorId, caseId: item._id, sourceRowId: row._id, fingerprint: row.fingerprint, productId: data.productId, invoiceNumber: value.invoice_number, batchNumber: value.batch_number, expiryDate: value.expiry_date, returnDate: value.return_date, quantity: value.quantity, quantityUnit: value.quantity_unit, reason: value.reason, createdAt: Date.now() });
      await ctx.db.patch(item._id, { evidenceChanged: true, status: item.latestDecisionId ? item.status : "awaiting_eligibility_review", updatedAt: Date.now() });
      await businessAudit(ctx, s.organizationId, args.actorUserId, "return_case", item._id, "return.source_added", "Accepted distributor claim linked to its stable return case");
    }
    const cursor = args.cursor + 30; return { done: cursor >= rows.length, cursor };
  },
});

type CaseFilters = { organizationId: Id<"organizations">; operationalUnitId?: Id<"operationalUnits">; distributorId?: Id<"distributors">; periodStart?: string; periodEnd?: string };
const caseFilters = { organizationId: v.id("organizations"), operationalUnitId: v.optional(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")), periodStart: v.optional(v.string()), periodEnd: v.optional(v.string()) };
export async function scopedCases(ctx: QueryCtx, args: CaseFilters) {
    const actor = await readScope(ctx, args); await ctx.db.query("maintenanceState").withIndex("by_key", (q) => q.eq("key", args.organizationId)).unique(); if (args.periodStart) date(args.periodStart); if (args.periodEnd) date(args.periodEnd);
    if (!actor.units.length || !actor.distributors.length) return [];
    const rows = await ctx.db.query("returnCases").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(...actor.units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), q.or(...actor.distributors.map((d) => q.eq(q.field("distributorId"), d._id))), args.periodStart ? q.gte(q.field("returnDate"), args.periodStart) : q.eq(true, true), args.periodEnd ? q.lte(q.field("returnDate"), args.periodEnd) : q.eq(true, true))).order("desc").take(1001);
    if (rows.length > 1000) return invalid("PILOT_CASE_LIMIT");
    const result = [];
    for (const item of rows) {
      const distributor = actor.distributors.find((d) => d._id === item.distributorId)!;
      const overdue = !!item.creditDueDate && !!item.dueTimezone && businessDate(Date.now(), item.dueTimezone) > item.creditDueDate && (item.approvedAmountPaise ?? 0) > item.issuedCreditAmountPaise;
      const common = { id: item._id, distributorId: item.distributorId, caseReference: item.caseReference, distributorReference: item.distributorReference, distributorName: distributor.name, status: overdue ? "credit_overdue" : item.status, evidenceChanged: item.evidenceChanged === true };
      result.push(actor.membership.role === "distributor" ? common : { ...common, claimedPaise: item.claimedAmountPaise, eligiblePaise: item.eligibleAmountPaise, approvedPaise: item.approvedAmountPaise, issuedPaise: item.issuedCreditAmountPaise, dueDate: item.creditDueDate, attention: item.attention, assignedUserId: item.assignedUserId });
    }
    return result;
}
export const list = query({ args: caseFilters, handler: scopedCases });
export const portfolio = query({
  args: caseFilters,
  handler: async (ctx, args) => {
    const actor = await readScope(ctx, args); const rows = await scopedCases(ctx, args);
    const review = rows.filter((r) => ["submitted", "evidence_processing", "awaiting_eligibility_review", "clarification_requested"].includes(r.status)).length;
    if (actor.membership.role === "distributor") return { rows, metrics: [{ key: "all", label: "Your return cases", count: rows.length }, { key: "review", label: "Awaiting review", count: review }, { key: "finance", label: "Approved awaiting credit", count: rows.filter((r) => ["approved_awaiting_credit", "partially_credited", "credit_overdue"].includes(r.status)).length }, { key: "closed", label: "Confirmed and closed", count: rows.filter((r) => r.status === "confirmed_closed").length }] };
    const internalRows = rows.filter((r) => "issuedPaise" in r);
    const balance = (r: typeof internalRows[number]) => typeof r.approvedPaise === "number" ? Math.max(0, sumPaise([r.approvedPaise, -r.issuedPaise])) : 0;
    const awaiting = sumPaise(internalRows.filter((r) => r.status === "approved_awaiting_credit").map(balance)); const partial = sumPaise(internalRows.filter((r) => ["partially_credited", "credit_overdue"].includes(r.status)).map(balance));
    const units = actor.units;
    const notes = units.length && actor.distributors.length ? await ctx.db.query("creditNotes").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(...units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), q.or(...actor.distributors.map((d) => q.eq(q.field("distributorId"), d._id))), args.periodStart ? q.gte(q.field("issuedDate"), args.periodStart) : q.eq(true, true), args.periodEnd ? q.lte(q.field("issuedDate"), args.periodEnd) : q.eq(true, true))).take(1001) : [];
    if (notes.length > 1000) return invalid("PILOT_CREDIT_LIMIT");
    const issued = sumPaise(notes.flatMap((n) => n.confirmedTotalPaise === undefined ? [] : [n.confirmedTotalPaise]));
    return { rows, metrics: [{ key: "review", label: "Awaiting eligibility review", count: review }, { key: "finance", label: "Approved awaiting credit", valuePaise: awaiting }, { key: "partial", label: "Partial or overdue credit", valuePaise: partial }, { key: "credits", label: "Issued credit in selected period", valuePaise: issued }] };
  },
});

export const detail = query({
  args: { caseId: v.id("returnCases") },
  handler: async (ctx, args) => {
    const actor = await caseAccess(ctx, args.caseId); const lines = await activeReturnLines(ctx, actor.item._id);
    if (actor.membership.role === "distributor") return { restricted: true as const, item: { id: actor.item._id, reference: actor.item.caseReference, distributorReference: actor.item.distributorReference, status: actor.item.status }, lines: lines.map((l) => ({ quantity: l.quantity, quantityUnit: l.quantityUnit, invoice: l.invoiceNumber, batch: l.batchNumber })) };
    const run = actor.item.latestRunId ? await ctx.db.get(actor.item.latestRunId) : null; const decision = actor.item.latestDecisionId ? await ctx.db.get(actor.item.latestDecisionId) : null;
    const policies = await ctx.db.query("policyVersions").withIndex("by_organization", (q) => q.eq("organizationId", actor.item.organizationId)).filter((q) => q.eq(q.field("operationalUnitId"), actor.item.operationalUnitId)).collect();
    const creditLines = await ctx.db.query("creditNoteLines").withIndex("by_case", (q) => q.eq("caseId", args.caseId)).collect(); const notes = []; for (const line of creditLines) { const note = await ctx.db.get(line.noteId); const confirmation = note?.latestConfirmationId ? await ctx.db.get(note.latestConfirmationId) : null; if (note) notes.push({ line, note, confirmed: confirmation?.lineIds.includes(line._id) === true }); }
    const products = []; for (const line of lines) { const product = await ctx.db.get(line.productId); products.push({ lineId: line._id, name: product?.name ?? "Unknown product", code: product?.code ?? "" }); }
    const invoiceEvidence = []; for (const sale of await manufacturerSales(ctx, actor.item.organizationId, actor.item.operationalUnitId!, actor.item.distributorId)) { if (!lines.some((line) => line.productId === sale.record.productId && line.invoiceNumber === sale.record.invoiceNumber && line.batchNumber === sale.record.batchNumber)) continue; const source = await ctx.db.get(sale.record.sourceRowId); if (source) invoiceEvidence.push({ invoice: sale.record, submissionId: source.submissionId }); }
    const claimEvidence = []; for (const line of lines) { const source = await ctx.db.get(line.sourceRowId); if (source) claimEvidence.push({ lineId: line._id, submissionId: source.submissionId }); }
    const events = await ctx.db.query("auditEvents").withIndex("by_target", (q) => q.eq("targetType", "return_case").eq("targetId", args.caseId)).order("desc").take(100);
    const history = []; for (const event of events) { const user = event.actorUserId ? await ctx.db.get(event.actorUserId) : null; history.push({ action: event.action, reason: event.reason, createdAt: event.createdAt, actorName: user?.displayName ?? "Recorded system action" }); }
    const distributor = await ctx.db.get(actor.item.distributorId); const unit = await ctx.db.get(actor.item.operationalUnitId!);
    return { restricted: false as const, item: actor.item, lines, products, invoiceEvidence, claimEvidence, history, unitName: unit?.name ?? "Operational unit", distributorName: distributor?.name ?? "Distributor", receipts: await activeReceipts(ctx, args.caseId), calculation: run ? JSON.parse(run.resultJson) as ReturnCalculation : null, runId: run?._id, decision, creditNotes: notes, policies: [...new Set(policies.map((p) => p.code))], policyVersions: policies, canReview: can(actor.membership.role, "return_review"), canReceipt: can(actor.membership.role, "receipt"), canCredit: can(actor.membership.role, "credit") };
  },
});

export const recordReceipt = mutation({
  args: { caseId: v.id("returnCases"), reference: v.string(), receivedDate: v.string(), lines: v.array(v.object({ returnLineId: v.id("returnLines"), quantity: v.string() })), verifiedPhysically: v.boolean(), supersedesId: v.optional(v.id("receiptRecords")), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await caseAccess(ctx, args.caseId, "receipt"); const reason = text(args.reason, 1000); if (!args.verifiedPhysically || reason.length < 3 || args.lines.length === 0 || args.lines.length > 100) return invalid("RECEIPT_FIELDS_REQUIRED"); date(args.receivedDate); const reference = code(args.reference);
    const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "receipt", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    const current = await activeReceipts(ctx, args.caseId); if (args.supersedesId) { const old = current.find((r) => r._id === args.supersedesId); if (!old || old.reference !== reference) return invalid("RECEIPT_ALREADY_SUPERSEDED"); } else if (current.some((r) => r.reference === reference)) return invalid("DUPLICATE_RECEIPT");
    const active = await activeReturnLines(ctx, args.caseId); const seen = new Set<string>(); const lines = [];
    for (const input of args.lines) { const line = active.find((l) => l._id === input.returnLineId); if (!line || seen.has(line._id)) return invalid("INVALID_RECEIPT_LINE"); seen.add(line._id); lines.push({ returnLineId: line._id, lineFingerprint: line.fingerprint, quantity: quantity(input.quantity) }); }
    const id = await ctx.db.insert("receiptRecords", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, caseId: args.caseId, reference, receivedDate: args.receivedDate, lines, verifiedPhysically: true, supersedesId: args.supersedesId, actorUserId: actor.user._id, reason, createdAt: Date.now() });
    await ctx.db.patch(args.caseId, { evidenceChanged: true, updatedAt: Date.now() }); await businessAudit(ctx, actor.item.organizationId, actor.user._id, "return_case", args.caseId, "receipt.confirmed", reason); return op.complete(id);
  },
});

export const evaluate = mutation({
  args: { caseId: v.id("returnCases"), policyCode: v.string(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await caseAccess(ctx, args.caseId, "return_review"); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED"); const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "return_evaluate", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    const calculation = await calculateReturn(ctx, actor.item, code(args.policyCode));
    const existing = await ctx.db.query("reconciliationRuns").withIndex("by_fingerprint", (q) => q.eq("organizationId", actor.item.organizationId).eq("kind", "returns").eq("targetId", args.caseId).eq("fingerprint", calculation.fingerprint)).unique();
    const runId = existing?._id ?? await ctx.db.insert("reconciliationRuns", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, kind: "returns", targetId: args.caseId, fingerprint: calculation.fingerprint, ruleIds: calculation.policyIds, sourceIds: calculation.sourceIds, resultJson: canonicalJson(calculation), actorUserId: actor.user._id, createdAt: Date.now() });
    const previousDecision = actor.item.latestDecisionId ? await ctx.db.get(actor.item.latestDecisionId) : null;
    await ctx.db.patch(args.caseId, { latestRunId: runId, claimedAmountPaise: calculation.claimedPaise ?? undefined, eligibleAmountPaise: calculation.eligiblePaise ?? undefined, status: actor.item.latestDecisionId ? actor.item.status : "awaiting_eligibility_review", attention: calculation.complete ? undefined : "EVIDENCE_OR_POLICY_MISSING", evidenceChanged: previousDecision ? previousDecision.runId !== runId : false, updatedAt: Date.now() });
    await discrepancy(ctx, { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId }, actor.user._id, "returns", "return_case", args.caseId, "RETURN_ELIGIBILITY", !calculation.complete || calculation.lines.some((l) => l.issues.length > 0), calculation.eligiblePaise ?? undefined);
    if (!existing) await businessAudit(ctx, actor.item.organizationId, actor.user._id, "return_case", args.caseId, "return.evaluated", reason); return op.complete(runId);
  },
});

export const decide = mutation({
  args: { caseId: v.id("returnCases"), runId: v.id("reconciliationRuns"), outcome: v.union(v.literal("approved"), v.literal("rejected"), v.literal("clarification")), quantities: v.array(v.object({ returnLineId: v.id("returnLines"), quantity: v.string() })), zeroCreditAcknowledged: v.boolean(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await caseAccess(ctx, args.caseId, "return_review"); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED"); const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "return_decision", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    const run = await ctx.db.get(args.runId); if (!run || run.organizationId !== actor.item.organizationId || run.targetId !== args.caseId || run.kind !== "returns" || actor.item.latestRunId !== run._id) return invalid("CURRENT_CALCULATION_REQUIRED");
    const snapshot = JSON.parse(run.resultJson) as ReturnCalculation; const current = await calculateReturn(ctx, actor.item, snapshot.policyCode); if (current.fingerprint !== snapshot.fingerprint) return invalid("STALE_CALCULATION_RECALCULATE");
    if (args.outcome !== "approved" && actor.item.issuedCreditAmountPaise > 0) return invalid("CREDITED_CASE_REQUIRES_FINANCE_REVIEW");
    const approvedLines = []; const seen = new Set<string>(); let dueDays = 365;
    if (args.outcome === "approved") {
      if (!current.complete || !actor.organization.timezone) return invalid("COMPLETE_EVIDENCE_AND_TIMEZONE_REQUIRED");
      for (const input of args.quantities) { const line = current.lines.find((l) => l.lineId === input.returnLineId); if (!line || seen.has(line.lineId) || !line.rounding || line.unitRate === null || line.taxPercent === null || line.deductionPercent === null || line.creditDueDays === null) return invalid("INVALID_APPROVAL_LINE"); seen.add(line.lineId); const qty = quantity(input.quantity); if (decimal(qty).gt(decimal(line.eligible))) return invalid("APPROVAL_EXCEEDS_ELIGIBLE"); if (decimal(qty).isZero()) continue; approvedLines.push({ returnLineId: line.lineId, quantity: qty, amountPaise: lineAmounts(qty, line.unitRate, line.taxPercent, line.deductionPercent, line.rounding).totalPaise }); dueDays = Math.min(dueDays, line.creditDueDays); }
      if (!approvedLines.length) return invalid("POSITIVE_APPROVAL_REQUIRED");
    }
    const amount = sumPaise(approvedLines.map((l) => l.amountPaise)); const dueDate = args.outcome === "approved" ? addDays(businessDate(Date.now(), actor.organization.timezone!), dueDays) : undefined;
    if (args.outcome === "approved" && amount === 0 && !args.zeroCreditAcknowledged) return invalid("ZERO_CREDIT_ACKNOWLEDGEMENT_REQUIRED");
    const id = await ctx.db.insert("returnDecisions", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, caseId: args.caseId, runId: run._id, outcome: args.outcome, approvedLines, approvedAmountPaise: amount, zeroCreditAcknowledged: args.outcome === "approved" && amount === 0 && args.zeroCreditAcknowledged, creditDueDate: dueDate, dueTimezone: actor.organization.timezone, actorUserId: actor.user._id, reason, createdAt: Date.now() });
    await ctx.db.patch(args.caseId, { latestDecisionId: id, approvedAmountPaise: args.outcome === "approved" ? amount : undefined, creditDueDate: dueDate, dueTimezone: actor.organization.timezone, evidenceChanged: false, attention: undefined, status: args.outcome === "approved" ? "approved_awaiting_credit" : args.outcome === "rejected" ? "rejected" : "clarification_requested", updatedAt: Date.now() });
    await businessAudit(ctx, actor.item.organizationId, actor.user._id, "return_case", args.caseId, `return.${args.outcome}`, reason, { before: { decisionId: actor.item.latestDecisionId, status: actor.item.status }, after: { decisionId: id, amountPaise: amount } }); await matchCaseCredits(ctx, args.caseId, actor.user._id); await discrepancy(ctx, { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId }, actor.user._id, "returns", "return_case", args.caseId, "RETURN_ELIGIBILITY", args.outcome === "clarification"); return op.complete(id);
  },
});
