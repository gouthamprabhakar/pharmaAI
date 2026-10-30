import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { activeOrganization, can, hasMfa, hasRecentMfa, type Capability } from "./permissions";
import { developmentMfaOptional } from "./developmentPolicy";

export type Scope = { organizationId: Id<"organizations">; operationalUnitId?: Id<"operationalUnits">; distributorId?: Id<"distributors"> };
type ReadCtx = Pick<QueryCtx, "db" | "auth">;
export const deny = (code = "ACCESS_DENIED"): never => { throw new ConvexError({ code }); };

export async function requireIdentity(ctx: Pick<QueryCtx, "auth" | "db">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return deny("UNAUTHENTICATED");
  if (identity.sts === "pending") return deny("SESSION_INCOMPLETE");
  if (typeof identity.sid === "string" && await ctx.db.query("revokedSessions").withIndex("by_session", (q) => q.eq("sessionId", identity.sid as string)).unique()) return deny("SESSION_REVOKED");
  return identity;
}

export async function requireAccess(ctx: ReadCtx, scope: Scope, capability: Capability = "read", sensitive = false) {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db.query("users").withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject)).unique();
  if (!user || user.active !== true) return deny();
  const organization = await ctx.db.get(scope.organizationId);
  if (!organization || organization.active !== true) return deny();
  // These claims are signed by Clerk. Never accept the active organization from request arguments alone.
  const activeOrg = activeOrganization(identity);
  if (!organization.clerkOrganizationId || activeOrg !== organization.clerkOrganizationId) return deny("ORGANIZATION_REQUIRED");
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", user._id).eq("organizationId", scope.organizationId)).unique();
  if (!membership?.active || !can(membership.role, capability, membership.exportGranted)) return deny();
  if (!developmentMfaOptional()) {
    if ((membership.role === "owner" || membership.role === "administrator") && !hasMfa(identity.fva)) return deny("MFA_REQUIRED");
    if (sensitive && !hasRecentMfa(identity.fva)) return deny("REVERIFICATION_REQUIRED");
  }
  if (scope.operationalUnitId) {
    const unit = await ctx.db.get(scope.operationalUnitId);
    if (!unit?.active || unit.organizationId !== scope.organizationId || !permitsUnit(membership, unit._id)) return deny();
  }
  if (scope.distributorId) {
    const distributor = await ctx.db.get(scope.distributorId);
    if (!distributor?.active || distributor.organizationId !== scope.organizationId || !permitsDistributor(membership, distributor._id)) return deny();
    if (scope.operationalUnitId && !distributor.operationalUnitIds?.includes(scope.operationalUnitId)) return deny();
  }
  return { identity, user, organization, membership };
}

export function permitsUnit(member: Doc<"memberships">, unitId: Id<"operationalUnits">) {
  return member.allUnits === true || member.operationalUnitIds?.includes(unitId) === true;
}
export function permitsDistributor(member: Doc<"memberships">, distributorId: Id<"distributors">) {
  return member.role !== "distributor" || member.distributorId === distributorId;
}

export async function requireGrantScope(ctx: ReadCtx, organizationId: Id<"organizations">, grant: { allUnits?: boolean; operationalUnitIds?: Id<"operationalUnits">[]; distributorId?: Id<"distributors"> }, existing = false) {
  const actor = await requireAccess(ctx, { organizationId }, "access", true);
  if (grant.allUnits && !actor.membership.allUnits) return deny();
  for (const operationalUnitId of grant.operationalUnitIds ?? []) {
    if (!existing) await requireAccess(ctx, { organizationId, operationalUnitId, distributorId: grant.distributorId }, "access", true);
    else {
      const unit = await ctx.db.get(operationalUnitId);
      if (!unit || unit.organizationId !== organizationId || !permitsUnit(actor.membership, operationalUnitId)) return deny();
    }
  }
  if (grant.distributorId) {
    if (!existing) await requireAccess(ctx, { organizationId, distributorId: grant.distributorId }, "access", true);
    else {
      const distributor = await ctx.db.get(grant.distributorId);
      if (!distributor || distributor.organizationId !== organizationId || !permitsDistributor(actor.membership, distributor._id)) return deny();
    }
  }
  return actor;
}

export async function requireRecordScope(ctx: ReadCtx, scope: Scope, capability: Capability) {
  if (!scope.operationalUnitId || !scope.distributorId) return deny("RECORD_SCOPE_REQUIRED");
  return requireAccess(ctx, scope, capability);
}

export async function audit(ctx: MutationCtx, organizationId: Id<"organizations">, actorUserId: Id<"users">, action: string, targetId: string, reason: string, change?: { before: unknown; after: unknown }) {
  return ctx.db.insert("auditEvents", { organizationId, actorUserId, action, targetType: "access", targetId, reason, beforeJson: change ? JSON.stringify(change.before) : undefined, afterJson: change ? JSON.stringify(change.after) : undefined, createdAt: Date.now() });
}
