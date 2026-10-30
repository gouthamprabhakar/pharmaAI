import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { deny } from "./lib/authorization";

function requireTestEnvironment() {
  if (process.env.PHARMAAI_ENVIRONMENT !== "development" || process.env.PHARMAAI_ENABLE_TEST_FIXTURES !== "true" || !/^https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev\/?$/.test(process.env.CLERK_JWT_ISSUER_DOMAIN ?? "")) return deny("TEST_FIXTURES_DISABLED");
}

// Internal operator-only fixtures for official Clerk/Playwright testing. These
// never authenticate browsers, accept credentials, or run in production.
export const provision = internalMutation({
  args: { runId: v.string(), clerkOrganizationId: v.string(), ownerSubject: v.string(), distributorSubject: v.string(), ownerEmail: v.string(), distributorEmail: v.string() },
  handler: async (ctx, args) => {
    requireTestEnvironment();
    if (!/^e2e-[a-z0-9-]{8,80}$/.test(args.runId) || !args.ownerEmail.endsWith("+clerk_test@example.com") || !args.distributorEmail.endsWith("+clerk_test@example.com")) return deny("INVALID_TEST_FIXTURE");
    const slug = args.runId;
    if (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique()) return deny("TEST_FIXTURE_ALREADY_EXISTS");
    const organizationId = await ctx.db.insert("organizations", { clerkOrganizationId: args.clerkOrganizationId, name: "Fictional Browser Test Manufacturer", slug, active: true, createdAt: Date.now() });
    const otherOrganizationId = await ctx.db.insert("organizations", { clerkOrganizationId: `org_${args.runId}_other`, name: "Other Fictional Test Manufacturer", slug: `${slug}-other`, active: true, createdAt: Date.now() });
    const unitId = await ctx.db.insert("operationalUnits", { organizationId, name: "Fictional Permitted Depot", code: "TEST-ONE", active: true });
    const deniedUnitId = await ctx.db.insert("operationalUnits", { organizationId, name: "Fictional Restricted Depot", code: "TEST-TWO", active: true });
    const distributorId = await ctx.db.insert("distributors", { organizationId, name: "Fictional Test Distributor", code: "TEST-D1", operationalUnitIds: [unitId], active: true });
    const otherDistributorId = await ctx.db.insert("distributors", { organizationId, name: "Other Fictional Test Distributor", code: "TEST-D2", operationalUnitIds: [unitId], active: true });
    const owner = await ctx.db.insert("users", { clerkUserId: args.ownerSubject, email: args.ownerEmail, displayName: "Fictional Test Owner", active: true, createdAt: Date.now() });
    const distributor = await ctx.db.insert("users", { clerkUserId: args.distributorSubject, email: args.distributorEmail, displayName: "Fictional Distributor User", active: true, createdAt: Date.now() });
    const ownerMembershipId = await ctx.db.insert("memberships", { organizationId, userId: owner, role: "owner", allUnits: true, operationalUnitIds: [], active: true, exportGranted: true, createdAt: Date.now() });
    const distributorMembershipId = await ctx.db.insert("memberships", { organizationId, userId: distributor, role: "distributor", allUnits: false, operationalUnitIds: [unitId], distributorId, active: true, exportGranted: false, createdAt: Date.now() });
    await ctx.db.insert("auditEvents", { organizationId, actorUserId: owner, action: "testing.fixture_created", targetType: "organization", targetId: organizationId, reason: "Fictional development-only automated browser fixture", createdAt: Date.now() });
    return { organizationId, otherOrganizationId, unitId, deniedUnitId, distributorId, otherDistributorId, ownerMembershipId, distributorMembershipId };
  },
});

export const deactivate = internalMutation({
  args: { organizationId: v.id("organizations"), runId: v.string(), distributorOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    requireTestEnvironment();
    const org = await ctx.db.get(args.organizationId);
    if (!org || org.slug !== args.runId || !org.slug.startsWith("e2e-")) return deny("INVALID_TEST_FIXTURE");
    const members = await ctx.db.query("memberships").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect();
    for (const member of members) if (member.active && (!args.distributorOnly || member.role === "distributor")) {
      await ctx.db.patch(member._id, { active: false });
      await ctx.db.insert("auditEvents", { organizationId: org._id, action: "testing.membership_deactivated", targetType: "membership", targetId: member._id, reason: "Development-only browser revocation test or teardown", createdAt: Date.now() });
    }
    if (!args.distributorOnly) await ctx.db.patch(org._id, { active: false });
    return { deactivated: true };
  },
});
