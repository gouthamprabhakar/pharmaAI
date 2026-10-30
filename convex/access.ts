import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, deny, permitsDistributor, permitsUnit, requireAccess, requireIdentity } from "./lib/authorization";
import { activeOrganization, hasMfa } from "./lib/permissions";

const inviteRole = v.union(v.literal("administrator"), v.literal("returns_operations"), v.literal("finance"), v.literal("inventory_control"), v.literal("data_operations"), v.literal("distributor"), v.literal("viewer"));
const role = v.union(v.literal("owner"), inviteRole);
const orgArgs = { organizationId: v.id("organizations") };

export const session = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "signed_out" as const };
    const activeOrg = activeOrganization(identity);
    if (typeof activeOrg !== "string") return { status: "organization_required" as const };
    const organization = await ctx.db.query("organizations").withIndex("by_clerk_organization", (q) => q.eq("clerkOrganizationId", activeOrg)).unique();
    const user = await ctx.db.query("users").withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject)).unique();
    if (!organization?.active || !user?.active) return { status: "invitation_required" as const };
    const membership = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", user._id).eq("organizationId", organization._id)).unique();
    if (!membership?.active) return { status: "invitation_required" as const };
    if ((membership.role === "owner" || membership.role === "administrator") && !hasMfa(identity.fva)) return { status: "mfa_required" as const };
    await requireAccess(ctx, { organizationId: organization._id });
    return { status: "authorized" as const, organizationId: organization._id, organizationName: organization.name, role: membership.role };
  },
});

export const context = query({
  args: orgArgs,
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args);
    const units = (await ctx.db.query("operationalUnits").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((unit) => unit.active && permitsUnit(access.membership, unit._id));
    const distributors = (await ctx.db.query("distributors").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((distributor) => distributor.active && permitsDistributor(access.membership, distributor._id) && distributor.operationalUnitIds?.some((id) => units.some((unit) => unit._id === id)));
    return { organization: { id: access.organization._id, name: access.organization.name, slug: access.organization.slug }, role: access.membership.role, units: units.map((unit) => ({ id: unit._id, name: unit.name, code: unit.code })), distributors: distributors.map((item) => ({ id: item._id, name: item.name, code: item.code })) };
  },
});

export const scopedProbe = query({
  args: { ...orgArgs, operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), capability: v.union(v.literal("return_submit"), v.literal("sales_submit"), v.literal("return_review"), v.literal("credit"), v.literal("sales_review")) },
  handler: async (ctx, args) => {
    await requireAccess(ctx, args, args.capability);
    return { permitted: true };
  },
});

export const changeMembership = mutation({
  args: { ...orgArgs, membershipId: v.id("memberships"), role, active: v.boolean(), allUnits: v.boolean(), operationalUnitIds: v.array(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")), exportGranted: v.boolean(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "access", true);
    if (args.reason.trim().length < 3 || args.reason.length > 1000 || args.idempotencyKey.length < 8 || args.idempotencyKey.length > 200) return deny("INVALID_REQUEST");
    const target = await ctx.db.get(args.membershipId);
    if (!target || target.organizationId !== args.organizationId) return deny();
    if ((target.role === "owner" || args.role === "owner") && actor.membership.role !== "owner") return deny();
    if (target.role === "owner" && (!args.active || args.role !== "owner")) {
      const owners = (await ctx.db.query("memberships").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((m) => m.active && m.role === "owner");
      if (owners.length <= 1) return deny("FINAL_OWNER_REQUIRED");
    }
    if (args.role === "distributor" && (!args.distributorId || args.allUnits || args.exportGranted)) return deny("INVALID_DISTRIBUTOR_SCOPE");
    if (args.allUnits && actor.membership.allUnits !== true) return deny();
    for (const operationalUnitId of args.operationalUnitIds) await requireAccess(ctx, { organizationId: args.organizationId, operationalUnitId }, "access", true);
    if (args.distributorId) {
      await requireAccess(ctx, { organizationId: args.organizationId, distributorId: args.distributorId }, "access", true);
      const distributor = await ctx.db.get(args.distributorId);
      if (args.operationalUnitIds.some((id) => !distributor?.operationalUnitIds?.includes(id))) return deny("INVALID_DISTRIBUTOR_SCOPE");
    }
    const request = JSON.stringify({ ...args, idempotencyKey: undefined });
    const key = await ctx.db.query("idempotencyKeys").withIndex("by_organization_key", (q) => q.eq("organizationId", args.organizationId).eq("key", args.idempotencyKey)).unique();
    if (key) {
      if (key.request !== request || key.actorUserId !== actor.user._id) return deny("IDEMPOTENCY_CONFLICT");
      return target._id;
    }
    const next = { role: args.role, active: args.active, allUnits: args.allUnits, operationalUnitIds: args.operationalUnitIds, distributorId: args.distributorId, exportGranted: args.exportGranted };
    await ctx.db.patch(target._id, next);
    await audit(ctx, args.organizationId, actor.user._id, "membership.changed", target._id, args.reason.trim(), { before: { role: target.role, active: target.active, allUnits: target.allUnits, operationalUnitIds: target.operationalUnitIds, distributorId: target.distributorId, exportGranted: target.exportGranted }, after: next });
    await ctx.db.insert("idempotencyKeys", { organizationId: args.organizationId, key: args.idempotencyKey, request, resultId: target._id, actorUserId: actor.user._id, createdAt: Date.now() });
    return target._id;
  },
});

export const prepareInvitation = mutation({
  args: { ...orgArgs, email: v.string(), role: inviteRole, operationalUnitIds: v.array(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "access", true);
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || args.idempotencyKey.length < 8 || args.idempotencyKey.length > 200) return deny("INVALID_REQUEST");
    if (args.role === "distributor" && (!args.distributorId || args.operationalUnitIds.length === 0)) return deny("INVALID_DISTRIBUTOR_SCOPE");
    for (const operationalUnitId of args.operationalUnitIds) await requireAccess(ctx, { organizationId: args.organizationId, operationalUnitId, distributorId: args.distributorId }, "access", true);
    const request = JSON.stringify({ ...args, email, idempotencyKey: undefined });
    const prior = await ctx.db.query("idempotencyKeys").withIndex("by_organization_key", (q) => q.eq("organizationId", args.organizationId).eq("key", args.idempotencyKey)).unique();
    if (prior) {
      if (prior.request !== request || prior.actorUserId !== actor.user._id) return deny("IDEMPOTENCY_CONFLICT");
      return { invitationId: prior.resultId, delivery: "not_sent" as const };
    }
    const id = await ctx.db.insert("invitations", { organizationId: args.organizationId, email, role: args.role, operationalUnitIds: args.operationalUnitIds, distributorId: args.distributorId, expiresAt: Date.now() + 7 * 86400000, status: "prepared", createdBy: actor.user._id, createdAt: Date.now() });
    await audit(ctx, args.organizationId, actor.user._id, "invitation.prepared", id, "Invitation prepared; provider delivery has not occurred");
    await ctx.db.insert("idempotencyKeys", { organizationId: args.organizationId, key: args.idempotencyKey, request, resultId: id, actorUserId: actor.user._id, createdAt: Date.now() });
    return { invitationId: id, delivery: "not_sent" as const };
  },
});

export const pendingInvitations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    if (identity.emailVerified !== true || !identity.email) return deny("VERIFIED_EMAIL_REQUIRED");
    const email = identity.email.trim().toLowerCase();
    const invitations = await ctx.db.query("invitations").withIndex("by_email", (q) => q.eq("email", email)).collect();
    const result = [];
    for (const invitation of invitations) {
      if (invitation.status !== "prepared" || invitation.expiresAt <= Date.now()) continue;
      const organization = await ctx.db.get(invitation.organizationId);
      if (!organization?.active) continue;
      result.push({ id: invitation._id, organizationName: organization.name, role: invitation.role, permittedUnitCount: invitation.operationalUnitIds.length, expiresAt: invitation.expiresAt, delivery: "not_sent" as const });
    }
    return result;
  },
});

export const revokeInvitation = mutation({
  args: { ...orgArgs, invitationId: v.id("invitations"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "access", true);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.organizationId !== args.organizationId) return deny();
    if (args.reason.trim().length < 3 || args.reason.length > 1000) return deny("INVALID_REQUEST");
    if (invitation.status === "revoked") return invitation._id;
    if (invitation.status === "accepted") return deny("REVOKE_MEMBERSHIP_INSTEAD");
    await ctx.db.patch(invitation._id, { status: "revoked" });
    await audit(ctx, args.organizationId, actor.user._id, "invitation.revoked", invitation._id, args.reason.trim(), { before: { status: invitation.status }, after: { status: "revoked" } });
    return invitation._id;
  },
});

export const acceptInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || identity.emailVerified !== true || identity.email?.trim().toLowerCase() !== invitation.email || invitation.status === "revoked" || invitation.expiresAt <= Date.now()) return deny("INVITATION_UNAVAILABLE");
    const organization = await ctx.db.get(invitation.organizationId);
    if (!organization?.active || !organization.clerkOrganizationId || activeOrganization(identity) !== organization.clerkOrganizationId) return deny("ORGANIZATION_REQUIRED");
    if (invitation.role === "administrator" && !hasMfa(identity.fva)) return deny("MFA_REQUIRED");
    for (const unitId of invitation.operationalUnitIds) {
      const unit = await ctx.db.get(unitId);
      if (!unit?.active || unit.organizationId !== invitation.organizationId) return deny();
    }
    if (invitation.distributorId) {
      const distributor = await ctx.db.get(invitation.distributorId);
      if (!distributor?.active || distributor.organizationId !== invitation.organizationId || invitation.operationalUnitIds.some((id) => !distributor.operationalUnitIds?.includes(id))) return deny();
    }
    let user = await ctx.db.query("users").withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject)).unique();
    if (user?.active === false) return deny();
    if (!user) {
      const id = await ctx.db.insert("users", { clerkUserId: identity.subject, email: invitation.email, displayName: identity.name ?? invitation.email, active: true, createdAt: Date.now() });
      user = await ctx.db.get(id);
    }
    if (!user) return deny();
    const existing = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", user._id).eq("organizationId", invitation.organizationId)).unique();
    if (invitation.status === "accepted") {
      if (invitation.acceptedBy !== user._id || !existing?.active) return deny();
      return existing._id;
    }
    // An invitation must never overwrite or reactivate an existing membership.
    if (existing) return deny("MEMBERSHIP_ALREADY_EXISTS");
    const membershipId = await ctx.db.insert("memberships", { organizationId: invitation.organizationId, userId: user._id, role: invitation.role, operationalUnitIds: invitation.operationalUnitIds, distributorId: invitation.distributorId, allUnits: false, active: true, exportGranted: false, createdAt: Date.now() });
    await ctx.db.patch(invitation._id, { status: "accepted", acceptedBy: user._id });
    await audit(ctx, invitation.organizationId, user._id, "invitation.accepted", membershipId, "Verified invited identity accepted access");
    return membershipId;
  },
});
