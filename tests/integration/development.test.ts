import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { modules } from "../backend.setup";

const args = { clerkOrganizationId: "org_pilot", organizationName: "Fictional Pilot", slug: "fictional-pilot", clerkUserId: "user_owner", email: "owner@example.test", displayName: "Fictional Owner" };
afterEach(() => vi.unstubAllEnvs());
function enableDevelopment() {
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "development");
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev");
}

test("workspace bootstrap denies production, missing stage and production issuer", async () => {
  const t = convexTest(schema, modules);
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "production");
  await expect(t.mutation(internal.development.provisionWorkspace, args)).rejects.toThrow("DEVELOPMENT_ONLY");
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "");
  await expect(t.mutation(internal.development.provisionWorkspace, args)).rejects.toThrow("DEVELOPMENT_ONLY");
  enableDevelopment();
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://clerk.production.example");
  await expect(t.mutation(internal.development.provisionWorkspace, args)).rejects.toThrow("DEVELOPMENT_ONLY");
  expect(await t.run((ctx) => ctx.db.query("memberships").collect())).toEqual([]);
});

test("verified development bootstrap is idempotent, audited and still enforces MFA", async () => {
  enableDevelopment();
  const t = convexTest(schema, modules);
  const result = await t.mutation(internal.development.provisionWorkspace, args);
  expect(result.created).toBe(true);
  expect((await t.mutation(internal.development.provisionWorkspace, args)).created).toBe(false);
  expect(await t.run((ctx) => ctx.db.query("organizations").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("memberships").collect())).toHaveLength(1);
  const audits = await t.run((ctx) => ctx.db.query("auditEvents").collect());
  expect(audits).toHaveLength(1);
  expect(audits[0].action).toBe("workspace.development_bootstrap");
  const client = t.withIdentity({ subject: args.clerkUserId, org_id: args.clerkOrganizationId, fva: [0, -1] });
  expect(await client.query(api.access.session, {})).toEqual({ status: "mfa_required" });
  expect((await t.withIdentity({ subject: args.clerkUserId, org_id: args.clerkOrganizationId, fva: [0, 0] }).query(api.access.session, {})).status).toBe("authorized");
});

test("bootstrap cannot reactivate a revoked membership", async () => {
  enableDevelopment();
  const t = convexTest(schema, modules);
  const result = await t.mutation(internal.development.provisionWorkspace, args);
  await t.run((ctx) => ctx.db.patch(result.membershipId, { active: false }));
  await expect(t.mutation(internal.development.provisionWorkspace, args)).rejects.toThrow("MEMBERSHIP_REQUIRES_REVIEW");
  expect((await t.run((ctx) => ctx.db.get(result.membershipId)))?.active).toBe(false);
});

test("approved development MFA exception preserves identity, tenant, final-owner and revocation checks", async () => {
  enableDevelopment();
  vi.stubEnv("PHARMAAI_DEVELOPMENT_MFA_OPTIONAL", "true");
  const t = convexTest(schema, modules);
  const result = await t.mutation(internal.development.provisionWorkspace, args);
  const client = t.withIdentity({ subject: args.clerkUserId, org_id: args.clerkOrganizationId });
  expect(await client.query(api.access.session, {})).toMatchObject({ status: "authorized", developmentMfaOptional: true });
  await expect(t.query(api.access.context, { organizationId: result.organizationId })).rejects.toThrow("UNAUTHENTICATED");
  await expect(t.withIdentity({ subject: args.clerkUserId, org_id: "org_other" }).query(api.access.context, { organizationId: result.organizationId })).rejects.toThrow("ORGANIZATION_REQUIRED");
  await expect(client.mutation(api.access.changeMembership, { organizationId: result.organizationId, membershipId: result.membershipId, role: "viewer", active: false, allUnits: false, operationalUnitIds: [], exportGranted: false, reason: "Remove final owner", idempotencyKey: "final-owner-dev" })).rejects.toThrow("FINAL_OWNER_REQUIRED");
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "production");
  expect(await client.query(api.access.session, {})).toEqual({ status: "mfa_required" });
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "development");
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://clerk.production.example");
  expect(await client.query(api.access.session, {})).toEqual({ status: "mfa_required" });
  enableDevelopment();
  await t.run((ctx) => ctx.db.patch(result.membershipId, { active: false }));
  await expect(client.query(api.access.context, { organizationId: result.organizationId })).rejects.toThrow("ACCESS_DENIED");
});
