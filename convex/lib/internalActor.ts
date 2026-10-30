import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { deny, permitsDistributor, permitsUnit, type Scope } from "./authorization";
import { can, type Capability } from "./permissions";

// Only internal jobs use a server-persisted actor reference. Public functions
// must use signed identity through requireAccess/caseAccess instead.
export async function internalActor(ctx: Pick<QueryCtx, "db">, scope: Scope, userId: Id<"users">, capability: Capability) {
  const user = await ctx.db.get(userId); const org = await ctx.db.get(scope.organizationId);
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", userId).eq("organizationId", scope.organizationId)).unique();
  if (!user?.active || !org?.active || !membership?.active || !can(membership.role, capability)) return deny();
  if (scope.operationalUnitId) { const unit = await ctx.db.get(scope.operationalUnitId); if (!unit?.active || unit.organizationId !== org._id || !permitsUnit(membership, unit._id)) return deny(); }
  if (scope.distributorId) { const distributor = await ctx.db.get(scope.distributorId); if (!distributor?.active || distributor.organizationId !== org._id || !permitsDistributor(membership, distributor._id) || (scope.operationalUnitId && !distributor.operationalUnitIds?.includes(scope.operationalUnitId))) return deny(); }
  return { user, organization: org, membership };
}
