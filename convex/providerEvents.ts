import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const apply = internalMutation({
  args: { eventId: v.string(), eventType: v.string(), subject: v.string(), organization: v.optional(v.string()), occurredAt: v.number(), role: v.optional(v.string()), blocked: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const prior = await ctx.db.query("providerEvents").withIndex("by_event", (q) => q.eq("eventId", args.eventId)).unique();
    if (prior) return { outcome: prior.outcome, duplicate: true };
    let applied = false;
    const recordAudit = async (organizationId: import("./_generated/dataModel").Id<"organizations">, targetType: string, targetId: string, before: unknown, after: unknown) => {
      await ctx.db.insert("auditEvents", { organizationId, action: `provider.${args.eventType}`, targetType, targetId, reason: "Verified Clerk lifecycle event", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), createdAt: Date.now() });
    };
    if (["session.revoked", "session.ended", "session.removed"].includes(args.eventType)) {
      const old = await ctx.db.query("revokedSessions").withIndex("by_session", (q) => q.eq("sessionId", args.subject)).unique();
      if (!old) await ctx.db.insert("revokedSessions", { sessionId: args.subject, revokedAt: args.occurredAt });
      applied = true;
    } else if (args.eventType === "organizationMembership.deleted" || (args.eventType === "organizationMembership.updated" && args.role !== "org:admin")) {
      const org = await ctx.db.query("organizations").withIndex("by_clerk_organization", (q) => q.eq("clerkOrganizationId", args.organization)).unique();
      const user = await ctx.db.query("users").withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.subject)).unique();
      if (org && user) {
        const member = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", user._id).eq("organizationId", org._id)).unique();
        // Provider role promotions never grant application privileges. Removal
        // wins over an equal-timestamp update; nothing here reactivates access.
        if (member && args.occurredAt >= (member.providerUpdatedAt ?? 0) && (args.eventType.endsWith("deleted") || ["owner", "administrator"].includes(member.role))) {
          await ctx.db.patch(member._id, { active: false, providerUpdatedAt: args.occurredAt });
          if (member.active) await recordAudit(org._id, "membership", member._id, { active: true, role: member.role }, { active: false, role: member.role });
          applied = true;
        }
      }
    } else if (args.eventType === "user.deleted" || (args.eventType === "user.updated" && args.blocked)) {
      const user = await ctx.db.query("users").withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.subject)).unique();
      if (user && args.occurredAt >= (user.providerUpdatedAt ?? 0)) {
        await ctx.db.patch(user._id, { active: false, providerUpdatedAt: args.occurredAt });
        const memberships = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", user._id)).collect();
        for (const member of memberships) if (user.active) await recordAudit(member.organizationId, "user", user._id, { active: true }, { active: false });
        applied = true;
      }
    } else if (args.eventType === "organization.deleted") {
      const org = await ctx.db.query("organizations").withIndex("by_clerk_organization", (q) => q.eq("clerkOrganizationId", args.subject)).unique();
      if (org && args.occurredAt >= (org.providerUpdatedAt ?? 0)) {
        await ctx.db.patch(org._id, { active: false, providerUpdatedAt: args.occurredAt });
        if (org.active) await recordAudit(org._id, "organization", org._id, { active: true }, { active: false });
        applied = true;
      }
    }
    const outcome = applied ? "applied" as const : "ignored" as const;
    await ctx.db.insert("providerEvents", { eventId: args.eventId, eventType: args.eventType, subject: args.subject, occurredAt: args.occurredAt, processedAt: Date.now(), outcome });
    return { outcome, duplicate: false };
  },
});
