import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { modules } from "./backend.setup";
import type { Role } from "../convex/lib/permissions";

export async function configurationFixture(role: Role = "owner") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const org = await ctx.db.insert("organizations", { clerkOrganizationId: "org_config", active: true, name: "Fictional Config Manufacturer", slug: "config", createdAt: 1 });
    const otherOrg = await ctx.db.insert("organizations", { clerkOrganizationId: "org_other", active: true, name: "Other Fictional Manufacturer", slug: "other", createdAt: 1 });
    const user = await ctx.db.insert("users", { clerkUserId: "user_config", active: true, email: "owner@example.test", displayName: "Fictional Owner", createdAt: 1 });
    const unit = await ctx.db.insert("operationalUnits", { organizationId: org, name: "Fictional Depot", code: "ONE", active: true });
    const denied = await ctx.db.insert("operationalUnits", { organizationId: org, name: "Restricted Depot", code: "TWO", active: true });
    const foreign = await ctx.db.insert("operationalUnits", { organizationId: otherOrg, name: "Foreign Depot", code: "THREE", active: true });
    const distributor = await ctx.db.insert("distributors", { organizationId: org, name: "Fictional Distributor", code: "D1", operationalUnitIds: [unit], active: true });
    const mixedDistributor = await ctx.db.insert("distributors", { organizationId: org, name: "Mixed Scope Distributor", code: "D2", operationalUnitIds: [unit, denied], active: true });
    const product = await ctx.db.insert("products", { organizationId: org, name: "Fictional Product", code: "P1", quantityUnit: "packs", active: true });
    const member = await ctx.db.insert("memberships", { organizationId: org, userId: user, role, active: true, allUnits: role === "owner", operationalUnitIds: [unit], distributorId: role === "distributor" ? distributor : undefined, createdAt: 1 });
    return { org, otherOrg, user, unit, denied, foreign, distributor, mixedDistributor, product, member };
  });
  return { t, ids, client: t.withIdentity({ subject: "user_config", org_id: "org_config", fva: [0, 0] }), base: { organizationId: ids.org, reason: "Reviewed manufacturer configuration", idempotencyKey: "config-operation-001" } };
}
export const policy = { dateBasis: "return_date" as const, allowedReasons: ["EXPIRED"], requiresReceipt: true, daysBeforeExpiry: 30, daysAfterExpiry: 90, creditDueDays: 30, deductionPercent: "0", taxPercent: "0", rounding: "half_up" as const };
