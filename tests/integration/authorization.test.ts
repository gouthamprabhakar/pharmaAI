import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { modules } from "../backend.setup";
import type { Role } from "../../convex/lib/permissions";

async function fixture(role: Role = "administrator") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const org = await ctx.db.insert("organizations", { name: "Fictional Manufacturer", slug: "fictional", clerkOrganizationId: "org_test", active: true, createdAt: 1 });
    const otherOrg = await ctx.db.insert("organizations", { name: "Other Manufacturer", slug: "other", clerkOrganizationId: "org_other", active: true, createdAt: 1 });
    const user = await ctx.db.insert("users", { clerkUserId: "user_test", email: "reviewer@example.test", displayName: "Test Reviewer", active: true, createdAt: 1 });
    const unit = await ctx.db.insert("operationalUnits", { organizationId: org, code: "ONE", name: "Permitted Depot", active: true });
    const deniedUnit = await ctx.db.insert("operationalUnits", { organizationId: org, code: "TWO", name: "Restricted Depot", active: true });
    const foreignUnit = await ctx.db.insert("operationalUnits", { organizationId: otherOrg, code: "OTHER", name: "Other Depot", active: true });
    const distributor = await ctx.db.insert("distributors", { organizationId: org, code: "D1", name: "Test Distributor", active: true, operationalUnitIds: [unit] });
    const otherDistributor = await ctx.db.insert("distributors", { organizationId: org, code: "D2", name: "Restricted Distributor", active: true, operationalUnitIds: [unit] });
    const member = await ctx.db.insert("memberships", { organizationId: org, userId: user, role, active: true, allUnits: role === "owner", operationalUnitIds: [unit], distributorId: role === "distributor" ? distributor : undefined, exportGranted: false, createdAt: 1 });
    return { org, otherOrg, user, unit, deniedUnit, foreignUnit, distributor, otherDistributor, member };
  });
  const asUser = (claims = {}) => t.withIdentity({ subject: "user_test", issuer: "https://test.clerk.accounts.dev", org_id: "org_test", fva: [0, 0], email: "reviewer@example.test", emailVerified: true, ...claims });
  return { t, ids, asUser };
}

test("denies anonymous identity, unknown subject and mismatched active organization", async () => {
  const { t, ids, asUser } = await fixture();
  await expect(t.query(api.access.context, { organizationId: ids.org })).rejects.toThrow("UNAUTHENTICATED");
  await expect(asUser({ subject: "unknown" }).query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ACCESS_DENIED");
  await expect(asUser({ org_id: "org_other" }).query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ORGANIZATION_REQUIRED");
});

test("context exposes only permitted units and distributors", async () => {
  const { ids, asUser } = await fixture("distributor");
  const context = await asUser().query(api.access.context, { organizationId: ids.org });
  expect(context.organization.name).toBe("Fictional Manufacturer");
  expect(context.units.map((u) => u.id)).toEqual([ids.unit]);
  expect(context.distributors.map((d) => d.id)).toEqual([ids.distributor]);
});

test("distributor cannot submit for another distributor or unit", async () => {
  const { ids, asUser } = await fixture("distributor");
  const args = { organizationId: ids.org, operationalUnitId: ids.unit, distributorId: ids.distributor, capability: "sales_submit" as const };
  expect(await asUser().query(api.access.scopedProbe, args)).toEqual({ permitted: true });
  await expect(asUser().query(api.access.scopedProbe, { ...args, distributorId: ids.otherDistributor })).rejects.toThrow("ACCESS_DENIED");
  await expect(asUser().query(api.access.scopedProbe, { ...args, operationalUnitId: ids.deniedUnit })).rejects.toThrow("ACCESS_DENIED");
  await expect(asUser().query(api.access.scopedProbe, { ...args, operationalUnitId: ids.foreignUnit })).rejects.toThrow("ACCESS_DENIED");
});

test("current DB membership revocation invalidates an already-authenticated identity", async () => {
  const { t, ids, asUser } = await fixture("viewer");
  const client = asUser();
  await client.query(api.access.context, { organizationId: ids.org });
  await t.run((ctx) => ctx.db.patch(ids.member, { active: false }));
  await expect(client.query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ACCESS_DENIED");
});

test.each(["user", "organization", "unit", "distributor"] as const)("%s deactivation blocks scoped access immediately", async (target) => {
  const { t, ids, asUser } = await fixture("distributor");
  await t.run((ctx) => ctx.db.patch(target === "organization" ? ids.org : ids[target], { active: false }));
  await expect(asUser().query(api.access.scopedProbe, { organizationId: ids.org, operationalUnitId: ids.unit, distributorId: ids.distributor, capability: "return_submit" })).rejects.toThrow("ACCESS_DENIED");
});

test("removing unit permission blocks an existing session on its next request", async () => {
  const { t, ids, asUser } = await fixture("inventory_control");
  const args = { organizationId: ids.org, operationalUnitId: ids.unit, distributorId: ids.distributor, capability: "sales_review" as const };
  await asUser().query(api.access.scopedProbe, args);
  await t.run((ctx) => ctx.db.patch(ids.member, { operationalUnitIds: [] }));
  await expect(asUser().query(api.access.scopedProbe, args)).rejects.toThrow("ACCESS_DENIED");
});

test.each(["owner", "administrator"] as const)("%s requires signed MFA age", async (role) => {
  const { ids, asUser } = await fixture(role);
  await expect(asUser({ fva: [0, -1] }).query(api.access.context, { organizationId: ids.org })).rejects.toThrow("MFA_REQUIRED");
  expect((await asUser().query(api.access.context, { organizationId: ids.org })).role).toBe(role);
});

test("wrong role cannot record credit; role downgrade takes effect immediately", async () => {
  const { t, ids, asUser } = await fixture("finance");
  const args = { organizationId: ids.org, operationalUnitId: ids.unit, distributorId: ids.distributor, capability: "credit" as const };
  await asUser().query(api.access.scopedProbe, args);
  await t.run((ctx) => ctx.db.patch(ids.member, { role: "viewer" }));
  await expect(asUser().query(api.access.scopedProbe, args)).rejects.toThrow("ACCESS_DENIED");
});

test("access change requires step-up and cannot remove final owner", async () => {
  const { ids, asUser } = await fixture("owner");
  const args = { organizationId: ids.org, membershipId: ids.member, role: "viewer" as const, active: false, allUnits: false, operationalUnitIds: [], exportGranted: false, reason: "Revoke access", idempotencyKey: "remove-owner-1" };
  await expect(asUser({ fva: [30, 30] }).mutation(api.access.changeMembership, args)).rejects.toThrow("REVERIFICATION_REQUIRED");
  await expect(asUser().mutation(api.access.changeMembership, args)).rejects.toThrow("FINAL_OWNER_REQUIRED");
});

test("access changes are audited once across retries; reused key with another payload is denied", async () => {
  const { t, ids, asUser } = await fixture();
  const args = { organizationId: ids.org, membershipId: ids.member, role: "administrator" as const, active: true, allUnits: false, operationalUnitIds: [ids.unit], exportGranted: true, reason: "Enable scoped export", idempotencyKey: "export-permission-1" };
  await asUser().mutation(api.access.changeMembership, args);
  await asUser().mutation(api.access.changeMembership, args);
  const audits = await t.run((ctx) => ctx.db.query("auditEvents").collect());
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ actorUserId: ids.user, action: "membership.changed", reason: "Enable scoped export" });
  expect(JSON.parse(audits[0].beforeJson!)).toMatchObject({ exportGranted: false });
  expect(JSON.parse(audits[0].afterJson!)).toMatchObject({ exportGranted: true });
  await expect(asUser().mutation(api.access.changeMembership, { ...args, reason: "Different payload" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});

test("prepared invitation is honest about delivery and cannot be claimed by another email", async () => {
  const { ids, asUser } = await fixture();
  const prepared = await asUser().mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "invited@example.test", role: "distributor", operationalUnitIds: [ids.unit], distributorId: ids.distributor, idempotencyKey: "invitation-prepare-1" });
  expect(prepared.delivery).toBe("not_sent");
  await expect(asUser().mutation(api.access.acceptInvitation, { invitationId: prepared.invitationId as never })).rejects.toThrow("INVITATION_UNAVAILABLE");
});

test("verified invitation grants only stored scope and acceptance retry never duplicates", async () => {
  const { t, ids, asUser } = await fixture();
  const args = { organizationId: ids.org, email: "invited@example.test", role: "distributor" as const, operationalUnitIds: [ids.unit], distributorId: ids.distributor, idempotencyKey: "invitation-prepare-2" };
  const prepared = await asUser().mutation(api.access.prepareInvitation, args);
  expect(await asUser().mutation(api.access.prepareInvitation, args)).toEqual(prepared);
  const invitee = asUser({ subject: "invited", email: "invited@example.test" });
  const invitation = { invitationId: prepared.invitationId as never };
  const id = await invitee.mutation(api.access.acceptInvitation, invitation);
  expect(await invitee.mutation(api.access.acceptInvitation, invitation)).toBe(id);
  const rows = await t.run((ctx) => ctx.db.query("memberships").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row._id === id)).toMatchObject({ role: "distributor", distributorId: ids.distributor, allUnits: false, operationalUnitIds: [ids.unit] });
  expect((await t.run((ctx) => ctx.db.query("auditEvents").collect())).map((event) => event.action)).toEqual(["invitation.prepared", "invitation.accepted"]);
});

test("expired and revoked invitations and unverified email never grant access", async () => {
  const { t, ids, asUser } = await fixture();
  const prepared = await asUser().mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "invited@example.test", role: "viewer", operationalUnitIds: [ids.unit], idempotencyKey: "invitation-prepare-3" });
  const invitationId = prepared.invitationId as never;
  await expect(asUser({ subject: "invited", email: "invited@example.test", emailVerified: false }).mutation(api.access.acceptInvitation, { invitationId })).rejects.toThrow("INVITATION_UNAVAILABLE");
  await t.run((ctx) => ctx.db.patch(invitationId, { expiresAt: 1 }));
  await expect(asUser({ subject: "invited", email: "invited@example.test" }).mutation(api.access.acceptInvitation, { invitationId })).rejects.toThrow("INVITATION_UNAVAILABLE");
  await t.run((ctx) => ctx.db.patch(invitationId, { expiresAt: Date.now() + 100000, status: "revoked" }));
  await expect(asUser({ subject: "invited", email: "invited@example.test" }).mutation(api.access.acceptInvitation, { invitationId })).rejects.toThrow("INVITATION_UNAVAILABLE");
});

test("missing signed organization and verification claims produce honest setup states", async () => {
  const { t, asUser } = await fixture();
  expect(await t.query(api.access.session, {})).toEqual({ status: "signed_out" });
  expect(await asUser({ org_id: undefined }).query(api.access.session, {})).toEqual({ status: "organization_required" });
  expect(await asUser({ fva: undefined }).query(api.access.session, {})).toEqual({ status: "mfa_required" });
  expect(await asUser({ subject: "unknown" }).query(api.access.session, {})).toEqual({ status: "invitation_required" });
});

test("a restricted administrator cannot grant all-unit access or a foreign invitation scope", async () => {
  const { ids, asUser } = await fixture();
  await expect(asUser().mutation(api.access.changeMembership, { organizationId: ids.org, membershipId: ids.member, role: "administrator", active: true, allUnits: true, operationalUnitIds: [], exportGranted: false, reason: "Attempt scope expansion", idempotencyKey: "scope-expansion-1" })).rejects.toThrow("ACCESS_DENIED");
  await expect(asUser().mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "new@example.test", role: "viewer", operationalUnitIds: [ids.foreignUnit], idempotencyKey: "foreign-invitation-1" })).rejects.toThrow("ACCESS_DENIED");
});

test("pending provider sessions are denied even with otherwise valid claims", async () => {
  const { ids, asUser } = await fixture();
  await expect(asUser({ sts: "pending" }).query(api.access.context, { organizationId: ids.org })).rejects.toThrow("SESSION_INCOMPLETE");
});

test("Clerk v2 organization claims work and conflicting signed tenant claims cannot switch scope", async () => {
  const { ids, asUser } = await fixture();
  expect((await asUser({ org_id: undefined, o: { id: "org_test", rol: "member" } }).query(api.access.context, { organizationId: ids.org })).role).toBe("administrator");
  await expect(asUser({ o: { id: "org_other" } }).query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ORGANIZATION_REQUIRED");
});

test("a removed member cannot reactivate themselves by replaying an accepted invitation", async () => {
  const { t, ids, asUser } = await fixture();
  const prepared = await asUser().mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "invited@example.test", role: "distributor", operationalUnitIds: [ids.unit], distributorId: ids.distributor, idempotencyKey: "revoked-invite-1" });
  const client = asUser({ subject: "invited", email: "invited@example.test" });
  const args = { invitationId: prepared.invitationId as never };
  const id = await client.mutation(api.access.acceptInvitation, args);
  await t.run((ctx) => ctx.db.patch(id, { active: false }));
  await expect(client.mutation(api.access.acceptInvitation, args)).rejects.toThrow("ACCESS_DENIED");
});

test("invitation preview is limited to the verified addressee and revocation is audited once", async () => {
  const { t, ids, asUser } = await fixture();
  const prepared = await asUser().mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "invited@example.test", role: "viewer", operationalUnitIds: [ids.unit], idempotencyKey: "preview-invitation-1" });
  expect(await asUser().query(api.access.pendingInvitations, {})).toEqual([]);
  const client = asUser({ subject: "invited", email: "invited@example.test" });
  expect(await client.query(api.access.pendingInvitations, {})).toMatchObject([{ organizationName: "Fictional Manufacturer", role: "viewer", permittedUnitCount: 1, delivery: "not_sent" }]);
  await expect(asUser({ emailVerified: false }).query(api.access.pendingInvitations, {})).rejects.toThrow("VERIFIED_EMAIL_REQUIRED");
  const args = { organizationId: ids.org, invitationId: prepared.invitationId as never, reason: "Invitation no longer needed" };
  await asUser().mutation(api.access.revokeInvitation, args);
  await asUser().mutation(api.access.revokeInvitation, args);
  expect(await client.query(api.access.pendingInvitations, {})).toEqual([]);
  const audits = await t.run((ctx) => ctx.db.query("auditEvents").collect());
  expect(audits.filter((row) => row.action === "invitation.revoked")).toHaveLength(1);
});
