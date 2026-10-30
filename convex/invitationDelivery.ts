"use node";

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const send = internalAction({
  args: { invitationId: v.id("invitations"), checkOnly: v.boolean() },
  handler: async (ctx, args): Promise<null> => {
    const grant = await ctx.runMutation(internal.invitations.claimDelivery, args);
    if (!grant) return null;
    const key = process.env.CLERK_SECRET_KEY;
    const appUrl = process.env.PHARMAAI_APP_URL;
    if (!key || !appUrl) { await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, unknown: true }); return null; }
    const clerk = createClerkClient({ secretKey: key });
    try {
      let providerId: string | undefined;
      // An uncertain request is reconciled by its stable application ID. It is
      // never blindly retried as another outbound invitation/email.
      if (grant.checkOnly) {
        for (let offset = 0; offset < 1000; offset += 100) {
          const page = await clerk.organizations.getOrganizationInvitationList({ organizationId: grant.clerkOrganizationId, limit: 100, offset });
          const found = page.data.find((i) => i.publicMetadata.pharmaaiInvitationId === args.invitationId);
          if (found && (found.status === "revoked" || found.status === "expired")) {
            await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, revoked: true });
            return null;
          }
          if (found && found.status !== "pending" && found.status !== "accepted") break;
          providerId = found?.id;
          if (providerId || offset + page.data.length >= page.totalCount) break;
        }
      } else {
        const result = await clerk.organizations.createOrganizationInvitation({ organizationId: grant.clerkOrganizationId, emailAddress: grant.email, inviterUserId: grant.inviterSubject, role: grant.role, expiresInDays: grant.expiresInDays, redirectUrl: new URL("/overview", appUrl).toString(), publicMetadata: { pharmaaiInvitationId: args.invitationId } });
        providerId = result.id;
      }
      const result = await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, providerInvitationId: providerId, unknown: !providerId });
      if (result.revoke && providerId) {
        await clerk.organizations.revokeOrganizationInvitation({ organizationId: grant.clerkOrganizationId, invitationId: providerId });
        await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, revoked: true });
      }
    } catch {
      await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, unknown: true });
    }
    return null;
  },
});

export const revoke = internalAction({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args): Promise<null> => {
    const reference = await ctx.runMutation(internal.invitations.providerReference, args);
    if (!reference || !process.env.CLERK_SECRET_KEY) return null;
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    try {
    let providerId = reference.providerInvitationId;
    if (!providerId) {
      for (let offset = 0; offset < 1000; offset += 100) {
        const page = await clerk.organizations.getOrganizationInvitationList({ organizationId: reference.clerkOrganizationId, status: ["pending"], limit: 100, offset });
        providerId = page.data.find((i) => i.publicMetadata.pharmaaiInvitationId === args.invitationId)?.id;
        if (providerId || offset + page.data.length >= page.totalCount) break;
      }
    }
    if (providerId) {
      await clerk.organizations.revokeOrganizationInvitation({ organizationId: reference.clerkOrganizationId, invitationId: providerId });
      await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, revoked: true });
    }
    } catch { await ctx.runMutation(internal.invitations.completeDelivery, { invitationId: args.invitationId, unknown: true }); }
    return null;
  },
});
