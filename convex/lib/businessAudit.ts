import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { canonicalJson } from "./contracts";
export async function businessAudit(ctx: MutationCtx, organizationId: Id<"organizations">, actorUserId: Id<"users"> | undefined, targetType: string, targetId: string, action: string, reason: string, change?: { before: unknown; after: unknown }) {
  const tables = { return_case: "returnCases", stock_variance: "stockVariances", review_item: "reviewItems", discrepancy: "discrepancies", submission: "submissions", distributor: "distributors", credit_note: "creditNotes" } as const;
  const table = tables[targetType as keyof typeof tables]; const id = table ? ctx.db.normalizeId(table, targetId) : null; const parent = id ? await ctx.db.get(id) : null;
  const scoped = parent as { operationalUnitId?: Id<"operationalUnits">; distributorId?: Id<"distributors"> } | null;
  return ctx.db.insert("auditEvents", { organizationId, operationalUnitId: scoped?.operationalUnitId, distributorId: scoped?.distributorId, actorUserId, targetType, targetId, action, reason, beforeJson: change ? canonicalJson(change.before) : undefined, afterJson: change ? canonicalJson(change.after) : undefined, createdAt: Date.now() });
}
