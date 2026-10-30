import { convexTest } from "convex-test";
import { randomBytes } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { afterEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { modules } from "../backend.setup";

afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  const t = convexTest(schema, modules);
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", `whsec_${randomBytes(32).toString("base64")}`);
  vi.stubEnv("CLERK_INSTANCE_ID", "ins_test");
  vi.stubEnv("PHARMAAI_DEVELOPMENT_MFA_OPTIONAL", "false");
  const ids = await t.run(async (ctx) => {
    const org = await ctx.db.insert("organizations", { name: "Fictional Webhook Manufacturer", slug: "webhook-test", clerkOrganizationId: "org_test", active: true, createdAt: 1 });
    const user = await ctx.db.insert("users", { clerkUserId: "user_test", email: "test@example.test", displayName: "Fictional Test", active: true, createdAt: 1 });
    const member = await ctx.db.insert("memberships", { organizationId: org, userId: user, role: "owner", active: true, allUnits: true, createdAt: 1 });
    return { org, user, member };
  });
  const client = t.withIdentity({ subject: "user_test", sid: "sess_test", org_id: "org_test", fva: [0, 0] });
  const send = (type: string, data: object, eventId = `msg_${randomBytes(6).toString("hex")}`, options: { instance?: string; occurredAt?: number; signedAt?: Date; tamper?: boolean } = {}) => {
    const body = JSON.stringify({ object: "event", type, data, timestamp: options.occurredAt ?? Date.now(), instance_id: options.instance ?? "ins_test" });
    const now = options.signedAt ?? new Date();
    const signature = new Webhook(process.env.CLERK_WEBHOOK_SIGNING_SECRET!).sign(eventId, now, body);
    return t.fetch("/clerk/webhook", { method: "POST", body: options.tamper ? body + " " : body, headers: { "svix-id": eventId, "svix-timestamp": String(Math.floor(now.getTime() / 1000)), "svix-signature": signature } });
  };
  return { t, ids, client, send };
}

test("webhook fails closed without configuration or signature and makes no changes", async () => {
  const { t } = await fixture();
  expect((await t.fetch("/clerk/webhook", { method: "POST", body: "{}" })).status).toBe(400);
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
  expect((await t.fetch("/clerk/webhook", { method: "POST", body: "{}" })).status).toBe(503);
  expect(await t.run((ctx) => ctx.db.query("providerEvents").collect())).toEqual([]);
});

test("real signature verification rejects tampering, another instance and stale signed delivery", async () => {
  const { t, send } = await fixture();
  expect((await send("user.deleted", { id: "user_test" }, undefined, { tamper: true })).status).toBe(400);
  expect((await send("user.deleted", { id: "user_test" }, undefined, { instance: "ins_other" })).status).toBe(400);
  expect((await send("user.deleted", { id: "user_test" }, undefined, { signedAt: new Date(Date.now() - 900_000) })).status).toBe(400);
  expect(await t.run((ctx) => ctx.db.query("providerEvents").collect())).toHaveLength(0);
});

test("verified membership removal blocks current access, preserves identity and audits once across retries", async () => {
  const { t, ids, client, send } = await fixture();
  await client.query(api.access.context, { organizationId: ids.org });
  const event = { organization: { id: "org_test" }, public_user_data: { user_id: "user_test" }, id: "orgmem_test" };
  expect((await send("organizationMembership.deleted", event, "msg_repeat")).status).toBe(200);
  expect((await send("organizationMembership.deleted", event, "msg_repeat")).status).toBe(200);
  await expect(client.query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ACCESS_DENIED");
  expect(await t.run((ctx) => ctx.db.get(ids.user))).not.toBeNull();
  expect((await t.run((ctx) => ctx.db.query("auditEvents").collect()))).toHaveLength(1);
  expect((await t.run((ctx) => ctx.db.query("providerEvents").collect()))).toHaveLength(1);
});

test("late created/promoted membership events never reactivate or grant privileges", async () => {
  const { t, ids, send } = await fixture();
  const event = { organization: { id: "org_test" }, public_user_data: { user_id: "user_test" }, id: "orgmem_test" };
  await send("organizationMembership.deleted", event);
  await send("organizationMembership.created", { ...event, role: "org:admin" });
  await send("organizationMembership.updated", { ...event, role: "org:admin" });
  expect((await t.run((ctx) => ctx.db.get(ids.member)))?.active).toBe(false);
  expect(await t.run((ctx) => ctx.db.query("memberships").collect())).toHaveLength(1);
});

test("provider administrator downgrade removes application administrative access", async () => {
  const { ids, client, send } = await fixture();
  await send("organizationMembership.updated", { organization: { id: "org_test" }, public_user_data: { user_id: "user_test" }, role: "org:member", id: "orgmem_test" });
  await expect(client.query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ACCESS_DENIED");
});

test("revoked sessions cannot use context or identity queries even with a previously valid signed identity", async () => {
  const { t, ids, client, send } = await fixture();
  await send("session.revoked", { id: "sess_test" }, "msg_session");
  await send("session.ended", { id: "sess_test" });
  expect(await t.run((ctx) => ctx.db.query("revokedSessions").collect())).toHaveLength(1);
  await expect(client.query(api.access.context, { organizationId: ids.org })).rejects.toThrow("SESSION_REVOKED");
  await expect(client.query(api.viewer.currentIdentity, {})).rejects.toThrow("SESSION_REVOKED");
});

test.each(["user.deleted", "user.updated", "organization.deleted"])("%s disables access while retaining historical records", async (type) => {
  const { t, ids, client, send } = await fixture();
  await send(type, { id: type.startsWith("organization") ? "org_test" : "user_test", banned: type === "user.updated" });
  await expect(client.query(api.access.context, { organizationId: ids.org })).rejects.toThrow("ACCESS_DENIED");
  expect(await t.run((ctx) => ctx.db.get(ids.org))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.user))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.member))).not.toBeNull();
});

test("an older event cannot overwrite a newer processed permission event", async () => {
  const { t, ids, send } = await fixture();
  const at = Date.now();
  const event = { organization: { id: "org_test" }, public_user_data: { user_id: "user_test" }, id: "orgmem_test" };
  await send("organizationMembership.deleted", event, undefined, { occurredAt: at });
  await send("organizationMembership.deleted", event, undefined, { occurredAt: at - 10_000 });
  expect((await t.run((ctx) => ctx.db.get(ids.member)))?.providerUpdatedAt).toBe(at);
  expect(await t.run((ctx) => ctx.db.query("auditEvents").collect())).toHaveLength(1);
});
