import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { digest, fingerprint } from "./contracts";
import { syncReview } from "./reviewRouting";
import { businessAudit } from "./businessAudit";

export async function discrepancy(ctx: MutationCtx, scope: { organizationId: Id<"organizations">; operationalUnitId: Id<"operationalUnits">; distributorId: Id<"distributors"> }, actor: Id<"users"> | undefined, category: Doc<"discrepancies">["category"], sourceType: string, sourceId: string, code: string, present: boolean, exposurePaise?: number) {
  const key = fingerprint("discrepancy", { category, sourceType, sourceId, code }); const old = await ctx.db.query("discrepancies").withIndex("by_fingerprint", (q) => q.eq("organizationId", scope.organizationId).eq("fingerprint", key)).unique();
  const table = sourceType === "return_case" ? "returnCases" : sourceType === "stock_variance" ? "stockVariances" : sourceType === "credit_note" ? "creditNotes" : sourceType === "confirmed_row" ? "confirmedRows" : "submissions";
  const sourceKey = ctx.db.normalizeId(table, sourceId); const source = sourceKey ? await ctx.db.get(sourceKey) : null;
  const state = source as Record<string, unknown> | null;
  const evidence = sourceType === "return_case" ? { run: state?.latestRunId, decision: state?.latestDecisionId, match: state?.latestCreditMatchId, changed: state?.evidenceChanged } : sourceType === "stock_variance" ? { report: state?.sourceReportId, run: state?.latestRunId } : sourceType === "credit_note" ? { confirmation: state?.latestConfirmationId } : source;
  const evidenceFingerprint = await digest({ evidence, code, exposurePaise, present });
  if (!old && !present) return null;
  if (!old) { const id = await ctx.db.insert("discrepancies", { ...scope, fingerprint: key, evidenceFingerprint, category, sourceType, sourceId, code, conditionPresent: true, resolved: false, exposurePaise, firstSeenAt: Date.now(), lastSeenAt: Date.now(), recurrence: 1 }); await businessAudit(ctx, scope.organizationId, actor, "discrepancy", id, "discrepancy.opened", code); const created = await ctx.db.get(id); if (created) await syncReview(ctx, created, actor); return id; }
  if (old.conditionPresent === present && old.exposurePaise === exposurePaise && old.evidenceFingerprint === evidenceFingerprint) { await syncReview(ctx, old, actor); return old._id; }
  await ctx.db.patch(old._id, { evidenceFingerprint, conditionPresent: present, resolved: present ? false : old.resolved, exposurePaise, lastSeenAt: Date.now(), recurrence: present && (old.resolved || !old.conditionPresent) ? old.recurrence + 1 : old.recurrence });
  await businessAudit(ctx, scope.organizationId, actor, "discrepancy", old._id, present && old.resolved ? "discrepancy.reopened" : "discrepancy.updated", code); const updated = await ctx.db.get(old._id); if (updated) await syncReview(ctx, updated, actor); return old._id;
}
