import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { modules } from "../backend.setup";

const provider = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), revoke: vi.fn() }));
vi.mock("@clerk/backend", () => ({ createClerkClient: () => ({ organizations: { createOrganizationInvitation: provider.create, getOrganizationInvitationList: provider.list, revokeOrganizationInvitation: provider.revoke } }) }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "development");
  vi.stubEnv("PHARMAAI_DEVELOPMENT_MFA_OPTIONAL", "true");
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev");
  vi.stubEnv("CLERK_SECRET_KEY", "unit-test-provider-mock");
  vi.stubEnv("PHARMAAI_APP_URL", "https://example.test");
  provider.create.mockReset().mockResolvedValue({ id: "orginv_test" });
  provider.list.mockReset().mockResolvedValue({ data: [], totalCount: 0 });
  provider.revoke.mockReset().mockResolvedValue({ id: "orginv_test" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const org = await ctx.db.insert("organizations", { name: "Fictional Invitation Manufacturer", slug: "invitation-test", clerkOrganizationId: "org_test", active: true, createdAt: 1 });
    const user = await ctx.db.insert("users", { clerkUserId: "user_test", email: "owner@example.test", displayName: "Fictional Owner", active: true, createdAt: 1 });
    const unit = await ctx.db.insert("operationalUnits", { organizationId: org, code: "ONE", name: "Permitted Unit", active: true });
    const deniedUnit = await ctx.db.insert("operationalUnits", { organizationId: org, code: "TWO", name: "Restricted Unit", active: true });
    const member = await ctx.db.insert("memberships", { organizationId: org, userId: user, role: "owner", allUnits: true, operationalUnitIds: [unit], active: true, createdAt: 1 });
    return { org, user, member, unit, deniedUnit };
  });
  const client = t.withIdentity({ subject: "user_test", sid: "sess_test", org_id: "org_test", email: "owner@example.test", emailVerified: true });
  const prepared = await client.mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "invitee@example.test", role: "viewer", operationalUnitIds: [ids.unit], idempotencyKey: "delivery-request-1" });
  const invitationId = prepared.invitationId as import("../../convex/_generated/dataModel").Id<"invitations">;
  const args = { organizationId: ids.org, invitationId };
  const finish = () => t.finishAllScheduledFunctions(() => vi.runAllTimers());
  return { t, ids, client, invitationId, args, finish };
}

test("delivery is authorized and explicit; missing configuration does not pretend to send", async () => {
  const { t, client, args, finish } = await fixture();
  await expect(t.mutation(api.invitations.requestDelivery, args)).rejects.toThrow("UNAUTHENTICATED");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  expect(await client.mutation(api.invitations.requestDelivery, args)).toEqual({ delivery: "not_configured" });
  await finish();
  expect(provider.create).not.toHaveBeenCalled();
});

test("repeated delivery requests call the provider once and persist one provider acknowledgement", async () => {
  const { t, client, invitationId, args, finish } = await fixture();
  expect(await client.mutation(api.invitations.requestDelivery, args)).toEqual({ delivery: "queued" });
  await client.mutation(api.invitations.requestDelivery, args);
  await finish();
  expect(provider.create).toHaveBeenCalledTimes(1);
  expect(provider.create.mock.calls[0][0]).toMatchObject({ role: "org:member", organizationId: "org_test", publicMetadata: { pharmaaiInvitationId: invitationId }, redirectUrl: "https://example.test/overview" });
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.deliveryState).toBe("sent");
  expect(await client.mutation(api.invitations.requestDelivery, args)).toEqual({ delivery: "sent" });
  await finish();
  expect(provider.create).toHaveBeenCalledTimes(1);
  expect((await t.run((ctx) => ctx.db.query("auditEvents").collect())).filter((a) => a.action === "invitation.provider_recorded")).toHaveLength(1);
});

test("uncertain provider failure is checked by stable metadata, never blindly resent", async () => {
  const { t, client, args, invitationId, finish } = await fixture();
  provider.create.mockRejectedValueOnce(new Error("Network interruption"));
  await client.mutation(api.invitations.requestDelivery, args);
  await finish();
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.deliveryState).toBe("unknown");
  provider.list.mockResolvedValue({ data: [{ id: "orginv_recovered", status: "pending", publicMetadata: { pharmaaiInvitationId: invitationId } }], totalCount: 1 });
  await client.mutation(api.invitations.requestDelivery, args);
  await finish();
  expect(provider.create).toHaveBeenCalledTimes(1);
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.providerInvitationId).toBe("orginv_recovered");
});

test("permission removal before the job executes blocks outbound side effects", async () => {
  const { t, ids, client, args, invitationId, finish } = await fixture();
  await client.mutation(api.invitations.requestDelivery, args);
  await t.run((ctx) => ctx.db.patch(ids.member, { active: false }));
  await finish();
  expect(provider.create).not.toHaveBeenCalled();
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.deliveryState).toBe("blocked");
});

test("a scoped administrator cannot change, revoke or deliver a grant outside their scope", async () => {
  const { t, ids, client, args, invitationId, finish } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch(ids.member, { role: "administrator", allUnits: false });
    await ctx.db.patch(invitationId, { operationalUnitIds: [ids.deniedUnit] });
  });
  await expect(client.mutation(api.invitations.requestDelivery, args)).rejects.toThrow("ACCESS_DENIED");
  await expect(client.mutation(api.access.revokeInvitation, { ...args, reason: "Outside scope" })).rejects.toThrow("ACCESS_DENIED");
  await expect(client.query(api.invitations.team, { organizationId: ids.org })).resolves.toMatchObject({ invitations: [] });
  await finish(); expect(provider.create).not.toHaveBeenCalled();
});

test("revocation racing a provider response cancels the provider invitation and prevents acceptance", async () => {
  const { t, client, args, invitationId, finish } = await fixture();
  provider.create.mockImplementationOnce(async () => { await t.run((ctx) => ctx.db.patch(invitationId, { status: "revoked" })); return { id: "orginv_race" }; });
  await client.mutation(api.invitations.requestDelivery, args);
  await finish();
  expect(provider.revoke).toHaveBeenCalledWith({ organizationId: "org_test", invitationId: "orginv_race" });
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.deliveryState).toBe("revoked");
  await expect(t.withIdentity({ subject: "user_invitee", sid: "sess_invitee", email: "invitee@example.test", emailVerified: true, org_id: "org_test" }).mutation(api.access.acceptInvitation, { invitationId })).rejects.toThrow("INVITATION_UNAVAILABLE");
});

test("an interrupted attempt can be reconciled after expiry without creating a second invitation", async () => {
  const { t, client, args, invitationId, finish } = await fixture();
  await t.run((ctx) => ctx.db.patch(invitationId, { deliveryState: "sending", deliveryAttempted: true, deliveryAuthorizedUntil: Date.now() - 1 }));
  provider.list.mockResolvedValue({ data: [{ id: "orginv_existing", status: "pending", publicMetadata: { pharmaaiInvitationId: invitationId } }], totalCount: 1 });
  await client.mutation(api.invitations.requestDelivery, args);
  await finish();
  expect(provider.create).not.toHaveBeenCalled();
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.deliveryState).toBe("sent");
});

test("a provider-revoked invitation found during recovery cannot be accepted", async () => {
  const { t, client, args, invitationId, finish } = await fixture();
  await t.run((ctx) => ctx.db.patch(invitationId, { deliveryState: "unknown", deliveryAttempted: true }));
  provider.list.mockResolvedValue({ data: [{ id: "orginv_revoked", status: "revoked", publicMetadata: { pharmaaiInvitationId: invitationId } }], totalCount: 1 });
  await client.mutation(api.invitations.requestDelivery, args);
  await finish();
  expect((await t.run((ctx) => ctx.db.get(invitationId)))?.status).toBe("revoked");
  expect(provider.create).not.toHaveBeenCalled();
});

test("a second operation key cannot create another pending invitation for the same email", async () => {
  const { ids, client } = await fixture();
  await expect(client.mutation(api.access.prepareInvitation, { organizationId: ids.org, email: "invitee@example.test", role: "viewer", operationalUnitIds: [ids.unit], idempotencyKey: "different-operation-key" })).rejects.toThrow("INVITATION_ALREADY_PENDING");
});
