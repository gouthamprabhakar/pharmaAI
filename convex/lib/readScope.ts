import type { QueryCtx } from "../_generated/server";
import { deny, permitsDistributor, permitsUnit, requireAccess, type Scope } from "./authorization";
import type { Capability } from "./permissions";

export async function readScope(ctx: QueryCtx, scope: Scope, capability: Capability = "read", sensitive = false) {
  const actor = await requireAccess(ctx, scope, capability, sensitive);
  const units = (await ctx.db.query("operationalUnits").withIndex("by_organization", (q) => q.eq("organizationId", scope.organizationId)).collect()).filter((u) => u.active && permitsUnit(actor.membership, u._id) && (!scope.operationalUnitId || u._id === scope.operationalUnitId));
  const distributors = (await ctx.db.query("distributors").withIndex("by_organization", (q) => q.eq("organizationId", scope.organizationId)).collect()).filter((d) => d.active && permitsDistributor(actor.membership, d._id) && (!scope.distributorId || d._id === scope.distributorId) && d.operationalUnitIds?.some((id) => units.some((u) => u._id === id)));
  if (scope.distributorId && !distributors.some((d) => d._id === scope.distributorId)) return deny();
  return { ...actor, units, distributors };
}
