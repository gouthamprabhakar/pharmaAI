import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { digest } from "./contracts";
import { decimal, sumPaise } from "./exact";
import { discrepancy } from "./discrepancy";
import { businessAudit } from "./businessAudit";
import { calculateReturn, type ReturnCalculation } from "./returnCalculation";

export async function activeCreditLines(ctx: Pick<QueryCtx, "db">, lines: Doc<"creditNoteLines">[]) { const result = []; for (const line of lines) { const child = await ctx.db.query("creditNoteLines").withIndex("by_superseded", (q) => q.eq("supersedesId", line._id)).first(); if (!child) result.push(line); } return result; }
export async function matchCaseCredits(ctx: MutationCtx, caseId: Id<"returnCases">, actorUserId: Id<"users">) {
  const item = await ctx.db.get(caseId); if (!item?.operationalUnitId) return;
  const scope = { organizationId: item.organizationId, operationalUnitId: item.operationalUnitId, distributorId: item.distributorId };
  const decision = item.latestDecisionId ? await ctx.db.get(item.latestDecisionId) : null;
  const all = await ctx.db.query("creditNoteLines").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect();
  const issued: Doc<"creditNoteLines">[] = []; const confirmationIds: Id<"creditNoteConfirmations">[] = []; let pending = false; let supportChanged = false;
  for (const noteId of new Set(all.map((l) => l.noteId))) {
    const note = await ctx.db.get(noteId); const confirmation = note?.latestConfirmationId ? await ctx.db.get(note.latestConfirmationId) : null;
    if (confirmation) confirmationIds.push(confirmation._id);
    const active = await activeCreditLines(ctx, await ctx.db.query("creditNoteLines").withIndex("by_note", (q) => q.eq("noteId", noteId)).collect());
    if (active.some((l) => !confirmation?.lineIds.includes(l._id) || l.matchRequired)) pending = true;
    for (const line of all.filter((l) => l.noteId === noteId)) if (confirmation?.lineIds.includes(line._id) && !line.matchRequired) issued.push(line);
  }
  if (decision?.outcome === "approved") { const approvedRun = await ctx.db.get(decision.runId); if (approvedRun) { const snapshot = JSON.parse(approvedRun.resultJson) as ReturnCalculation; supportChanged = (await calculateReturn(ctx, item, snapshot.policyCode)).fingerprint !== snapshot.fingerprint; if (supportChanged) pending = true; } else { supportChanged = true; pending = true; } }
  const issuedPaise = sumPaise(issued.map((l) => l.amountPaise));
  if (decision?.outcome !== "approved") { await ctx.db.patch(caseId, { issuedCreditAmountPaise: issuedPaise, attention: all.length ? "CREDIT_WITHOUT_APPROVAL" : item.attention, updatedAt: Date.now() }); await discrepancy(ctx, scope, actorUserId, "finance", "return_case", caseId, "CREDIT_WITHOUT_APPROVAL", all.length > 0, issuedPaise); return; }
  const expectedPaise = decision.approvedAmountPaise; const difference = sumPaise([expectedPaise, -issuedPaise]); const outstandingPaise = difference > 0 ? difference : 0; const excessPaise = difference < 0 ? -difference : 0;
  let quantityMismatch = false;
  const approvedQuantities = new Map<string, ReturnType<typeof decimal>>();
  for (const approved of decision.approvedLines) { const line = await ctx.db.get(approved.returnLineId); if (line) approvedQuantities.set(line.fingerprint, (approvedQuantities.get(line.fingerprint) ?? decimal("0")).plus(decimal(approved.quantity))); }
  const reportedQuantities = new Map<string, ReturnType<typeof decimal>>();
  for (const credit of issued) for (const q of credit.quantities) { const line = await ctx.db.get(q.returnLineId); if (!line || line.caseId !== caseId || !approvedQuantities.has(line.fingerprint)) quantityMismatch = true; else reportedQuantities.set(line.fingerprint, (reportedQuantities.get(line.fingerprint) ?? decimal("0")).plus(decimal(q.quantity))); }
  for (const [key, quantity] of reportedQuantities) if (quantity.gt(approvedQuantities.get(key)!) || (difference === 0 && !quantity.eq(approvedQuantities.get(key)!))) quantityMismatch = true;
  const status = pending ? "unconfirmed" as const : excessPaise > 0 || quantityMismatch ? "excess" as const : difference === 0 && (issued.length > 0 || decision.zeroCreditAcknowledged) ? "exact" as const : issuedPaise > 0 ? "partial" as const : "awaiting_credit" as const;
  const key = await digest({ caseId, decisionId: decision._id, lines: all.map((l) => l._id).sort(), confirmedLines: issued.map((l) => l._id).sort(), confirmationIds: confirmationIds.sort(), expectedPaise, issuedPaise, status });
  const prior = await ctx.db.query("creditMatches").withIndex("by_fingerprint", (q) => q.eq("organizationId", item.organizationId).eq("fingerprint", key)).unique();
  const id = prior?._id ?? await ctx.db.insert("creditMatches", { ...scope, caseId, decisionId: decision._id, fingerprint: key, expectedPaise, issuedPaise, outstandingPaise, excessPaise, noteLineIds: issued.map((l) => l._id), confirmationIds, status, actorUserId, createdAt: Date.now() });
  await ctx.db.patch(caseId, { latestCreditMatchId: id, issuedCreditAmountPaise: issuedPaise, status: status === "exact" ? "confirmed_closed" : status === "partial" ? "partially_credited" : "approved_awaiting_credit", attention: supportChanged ? "EVIDENCE_CHANGED" : pending ? "UNCONFIRMED_CREDIT_EVIDENCE" : quantityMismatch ? "CREDIT_QUANTITY_MISMATCH" : excessPaise > 0 ? "EXCESS_CREDIT" : undefined, evidenceChanged: supportChanged, updatedAt: Date.now() });
  await discrepancy(ctx, scope, actorUserId, "finance", "return_case", caseId, "CREDIT_BALANCE", difference !== 0 || pending || quantityMismatch, outstandingPaise || excessPaise);
  if (!prior) await businessAudit(ctx, item.organizationId, actorUserId, "return_case", caseId, "credit.matched", "Compared human-confirmed issued credit evidence with the approved decision");
}
