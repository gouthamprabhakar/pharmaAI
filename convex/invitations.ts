import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { audit, deny, permitsUnit, requireAccess, requireGrantScope } from "./lib/authorization";
import { can, hasRecentMfa } from "./lib/permissions";
import { developmentMfaOptional } from "./lib/developmentPolicy";

export const team = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "access");
    const allowed = (grant: { allUnits?: boolean; operationalUnitIds?: import("./_generated/dataModel").Id<"operationalUnits">[] }) => actor.membership.allUnits || (!grant.allUnits && (grant.operationalUnitIds ?? []).every((id) => permitsUnit(actor.membership, id)));
    const members = await ctx.db.query("memberships").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect();
    const result = [];
    for (const member of members.filter(allowed)) {
      const user = await ctx.db.get(member.userId);
      if (user) result.push({ id: member._id, displayName: user.displayName, email: user.email, role: member.role, active: member.active && user.active === true });
    }
    const invitations = (await ctx.db.query("invitations").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter(allowed);
    return { members: result, invitations: invitations.map((i) => ({ id: i._id, email: i.email, role: i.role, status: i.expiresAt <= Date.now() && i.status === "prepared" ? "expired" : i.status, delivery: i.deliveryState ?? "not_sent" })) };
  },
});

export const requestDelivery = mutation({
  args: { organizationId: v.id("organizations"), invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "access", true);
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.organizationId !== args.organizationId) return deny();
    await requireGrantScope(ctx, args.organizationId, invite);
    if (invite.status !== "prepared" || invite.expiresAt <= Date.now()) return deny("INVITATION_UNAVAILABLE");
    if (!process.env.CLERK_SECRET_KEY || !process.env.PHARMAAI_APP_URL) return { delivery: "not_configured" as const };
    const staleAttempt = ["sending", "checking"].includes(invite.deliveryState ?? "") && (invite.deliveryAuthorizedUntil ?? 0) <= Date.now();
    if (invite.deliveryState && !["unknown", "blocked"].includes(invite.deliveryState) && !staleAttempt) return { delivery: invite.deliveryState };
    const checkOnly = invite.deliveryAttempted === true;
    await ctx.db.patch(invite._id, { deliveryState: "queued", deliveryActorId: actor.user._id, deliveryAuthorizedUntil: Date.now() + 60_000, deliveryMfaVerified: hasRecentMfa(actor.identity.fva) });
    await audit(ctx, args.organizationId, actor.user._id, "invitation.delivery_requested", invite._id, checkOnly ? "Reconcile an uncertain provider delivery without resending" : "Send the prepared workspace invitation");
    await ctx.scheduler.runAfter(0, internal.invitationDelivery.send, { invitationId: invite._id, checkOnly });
    return { delivery: "queued" as const };
  },
});

export const claimDelivery = internalMutation({
  args: { invitationId: v.id("invitations"), checkOnly: v.boolean() },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.status !== "prepared" || invite.deliveryState !== "queued") return null;
    const org = await ctx.db.get(invite.organizationId);
    const actor = invite.deliveryActorId ? await ctx.db.get(invite.deliveryActorId) : null;
    const member = actor ? await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", actor._id).eq("organizationId", invite.organizationId)).unique() : null;
    let permitted = Boolean(org?.active && org.clerkOrganizationId && actor?.active && member?.active && can(member.role, "access") && (invite.deliveryAuthorizedUntil ?? 0) > Date.now() && invite.expiresAt > Date.now() && (developmentMfaOptional() || invite.deliveryMfaVerified));
    for (const id of invite.operationalUnitIds) {
      const unit = await ctx.db.get(id);
      if (!member || !unit?.active || unit.organizationId !== invite.organizationId || !permitsUnit(member, id)) permitted = false;
    }
    if (invite.distributorId) {
      const distributor = await ctx.db.get(invite.distributorId);
      if (!distributor?.active || distributor.organizationId !== invite.organizationId || invite.operationalUnitIds.some((id) => !distributor.operationalUnitIds?.includes(id))) permitted = false;
    }
    if (!permitted || !org?.clerkOrganizationId || !actor) {
      await ctx.db.patch(invite._id, { deliveryState: "blocked" });
      return null;
    }
    const checkOnly = args.checkOnly || invite.deliveryAttempted === true;
    await ctx.db.patch(invite._id, { deliveryState: checkOnly ? "checking" : "sending", deliveryAttempted: true });
    return { email: invite.email, clerkOrganizationId: org.clerkOrganizationId, inviterSubject: actor.clerkUserId, role: invite.role === "administrator" ? "org:admin" : "org:member", checkOnly, expiresInDays: Math.max(1, Math.min(7, Math.ceil((invite.expiresAt - Date.now()) / 86400000))) };
  },
});

export const completeDelivery = internalMutation({
  args: { invitationId: v.id("invitations"), providerInvitationId: v.optional(v.string()), unknown: v.optional(v.boolean()), revoked: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) return { revoke: false };
    if (args.revoked) {
      if (invite.status !== "revoked") await audit(ctx, invite.organizationId, invite.deliveryActorId ?? invite.createdBy, "invitation.provider_revoked", invite._id, "The provider invitation is revoked or expired; application acceptance is blocked");
      await ctx.db.patch(invite._id, { deliveryState: "revoked", status: "revoked" });
      return { revoke: false };
    }
    if (args.unknown || !args.providerInvitationId) {
      if (["sending", "checking", "revocation_pending"].includes(invite.deliveryState ?? "")) await ctx.db.patch(invite._id, { deliveryState: "unknown" });
      return { revoke: false };
    }
    if (invite.providerInvitationId && invite.providerInvitationId !== args.providerInvitationId) return deny("DELIVERY_CONFLICT");
    const revoke = invite.status === "revoked" || invite.expiresAt <= Date.now();
    if (invite.deliveryState !== "sent" || !invite.providerInvitationId) {
      await ctx.db.patch(invite._id, { deliveryState: revoke ? "unknown" : "sent", providerInvitationId: args.providerInvitationId });
      await audit(ctx, invite.organizationId, invite.deliveryActorId ?? invite.createdBy, "invitation.provider_recorded", invite._id, "Clerk returned or reconciled the invitation identifier; this is not proof of inbox delivery");
    }
    return { revoke };
  },
});

export const providerReference = internalMutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.status !== "revoked") return null;
    const org = await ctx.db.get(invite.organizationId);
    return org?.clerkOrganizationId ? { clerkOrganizationId: org.clerkOrganizationId, providerInvitationId: invite.providerInvitationId } : null;
  },
});
