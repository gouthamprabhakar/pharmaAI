import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { fingerprint } from "./contracts";
import { businessAudit } from "./businessAudit";

export async function discrepancy(ctx: MutationCtx, scope: { organizationId: Id<"organizations">; operationalUnitId: Id<"operationalUnits">; distributorId: Id<"distributors"> }, actor: Id<"users">, category: Doc<"discrepancies">["category"], sourceType: string, sourceId: string, code: string, present: boolean, exposurePaise?: number) {
  const key = fingerprint("discrepancy", { category, sourceType, sourceId, code }); const old = await ctx.db.query("discrepancies").withIndex("by_fingerprint", (q) => q.eq("organizationId", scope.organizationId).eq("fingerprint", key)).unique();
  if (!old && !present) return null;
  if (!old) { const id = await ctx.db.insert("discrepancies", { ...scope, fingerprint: key, category, sourceType, sourceId, code, conditionPresent: true, resolved: false, exposurePaise, firstSeenAt: Date.now(), lastSeenAt: Date.now(), recurrence: 1 }); await businessAudit(ctx, scope.organizationId, actor, "discrepancy", id, "discrepancy.opened", code); return id; }
  if (old.conditionPresent === present && old.exposurePaise === exposurePaise && !old.resolved) return old._id;
  await ctx.db.patch(old._id, { conditionPresent: present, resolved: present ? false : old.resolved, exposurePaise, lastSeenAt: Date.now(), recurrence: present && (old.resolved || !old.conditionPresent) ? old.recurrence + 1 : old.recurrence });
  await businessAudit(ctx, scope.organizationId, actor, "discrepancy", old._id, present && old.resolved ? "discrepancy.reopened" : "discrepancy.updated", code); return old._id;
}
