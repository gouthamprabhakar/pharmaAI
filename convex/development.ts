import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { audit, deny } from "./lib/authorization";

// Operations-only bootstrap. Not callable by an application client. The operator
// must first verify this subject's administrator membership through Clerk.
export const provisionWorkspace = internalMutation({
  args: { clerkOrganizationId: v.string(), organizationName: v.string(), slug: v.string(), clerkUserId: v.string(), email: v.string(), displayName: v.string() },
  handler: async (ctx, args) => {
    if (process.env.PHARMAAI_ENVIRONMENT !== "development" || !process.env.CLERK_JWT_ISSUER_DOMAIN?.endsWith(".clerk.accounts.dev")) return deny("DEVELOPMENT_ONLY");
    if (!args.clerkOrganizationId.startsWith("org_") || !args.clerkUserId.startsWith("user_") || !args.organizationName.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) return deny("INVALID_REQUEST");
    let organization = await ctx.db.query("organizations").withIndex("by_clerk_organization", (q) => q.eq("clerkOrganizationId", args.clerkOrganizationId)).unique();
    const sameSlug = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (sameSlug && sameSlug.clerkOrganizationId !== args.clerkOrganizationId) return deny("WORKSPACE_CONFLICT");
    if (organization && organization.active !== true) return deny("WORKSPACE_REQUIRES_REVIEW");
    if (!organization) {
      const id = await ctx.db.insert("organizations", { clerkOrganizationId: args.clerkOrganizationId, name: args.organizationName.trim(), slug: args.slug, active: true, createdAt: Date.now() });
      organization = await ctx.db.get(id);
    }
    if (!organization) return deny();
    let user = await ctx.db.query("users").withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId)).unique();
    if (user && user.active !== true) return deny("MEMBERSHIP_REQUIRES_REVIEW");
    if (!user) {
      const id = await ctx.db.insert("users", { clerkUserId: args.clerkUserId, email: args.email.toLowerCase(), displayName: args.displayName, active: true, createdAt: Date.now() });
      user = await ctx.db.get(id);
    }
    if (!user) return deny();
    const membership = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", user._id).eq("organizationId", organization._id)).unique();
    if (membership) {
      if (!membership.active || membership.role !== "owner") return deny("MEMBERSHIP_REQUIRES_REVIEW");
      return { organizationId: organization._id, membershipId: membership._id, created: false };
    }
    const membershipId = await ctx.db.insert("memberships", { organizationId: organization._id, userId: user._id, role: "owner", active: true, allUnits: true, operationalUnitIds: [], exportGranted: true, createdAt: Date.now() });
    await audit(ctx, organization._id, user._id, "workspace.development_bootstrap", membershipId, "Operator verified the existing account's Clerk organization administrator membership", { before: null, after: { role: "owner", active: true, allUnits: true } });
    return { organizationId: organization._id, membershipId, created: true };
  },
});

// Development-only recovery for clearing an abandoned staged upload that is
// intentionally hidden from confirmed submission history.
export const discardUnconfirmedSubmission = internalMutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    if (process.env.PHARMAAI_ENVIRONMENT !== "development" || !process.env.CLERK_JWT_ISSUER_DOMAIN?.endsWith(".clerk.accounts.dev")) return deny("DEVELOPMENT_ONLY");
    const submission = await ctx.db.get(args.submissionId); if (!submission) return { discarded: false };
    if (["accepted", "replaced", "confirming"].includes(submission.status)) return deny("CONFIRMED_UPLOAD_CANNOT_BE_DISCARDED");
    const jobs = await ctx.db.query("jobs").withIndex("by_submission", (q) => q.eq("submissionId", submission._id)).collect();
    const rows = await ctx.db.query("importRows").withIndex("by_submission_row", (q) => q.eq("submissionId", submission._id)).collect();
    const files = await ctx.db.query("evidenceFiles").withIndex("by_submission", (q) => q.eq("submissionId", submission._id)).collect();
    const intents = (await ctx.db.query("uploadIntents").withIndex("by_organization", (q) => q.eq("organizationId", submission.organizationId)).collect()).filter((intent) => intent.submissionId === submission._id);
    for (const row of rows) await ctx.db.delete(row._id);
    for (const job of jobs) await ctx.db.delete(job._id);
    for (const file of files) { await ctx.storage.delete(file.storageId); await ctx.db.delete(file._id); }
    for (const intent of intents) await ctx.db.delete(intent._id);
    await ctx.db.delete(submission._id);
    return { discarded: true };
  },
});
