import { expect, test, vi, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { configurationFixture, policy } from "../configuration.fixture";

afterEach(() => vi.unstubAllEnvs());
test("authorized configuration persists exact inputs, one immutable history and one audit on retry", async () => {
  const { t, client, base, ids } = await configurationFixture();
  const args = { ...base, name: "Fictional Updated Manufacturer", timezone: "Asia/Kolkata" };
  expect(await client.mutation(api.configuration.saveOrganization, args)).toBe(ids.org);
  expect(await client.mutation(api.configuration.saveOrganization, args)).toBe(ids.org);
  const data = await client.query(api.configuration.read, { organizationId: ids.org }); expect(data.organization.timezone).toBe("Asia/Kolkata");
  const history = await t.run((ctx) => ctx.db.query("configurationVersions").collect()); expect(history).toHaveLength(1); expect(history[0].actorUserId).toBe(ids.user);
  expect(await t.run((ctx) => ctx.db.query("auditEvents").collect())).toHaveLength(1);
  await expect(client.mutation(api.configuration.saveOrganization, { ...args, name: "Changed request" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});
test.each(["distributor", "viewer", "finance", "returns_operations", "inventory_control", "data_operations"] as const)("%s cannot read or change internal configuration", async (role) => {
  const { client, ids, base } = await configurationFixture(role);
  await expect(client.query(api.configuration.read, { organizationId: ids.org })).rejects.toThrow("ACCESS_DENIED");
  await expect(client.mutation(api.configuration.saveUnit, { ...base, code: "NEW", name: "New", type: "depot", workflows: ["returns"], active: true })).rejects.toThrow("ACCESS_DENIED");
});
test("anonymous, foreign organization and removed permissions deny saved configuration", async () => {
  const { t, client, ids, base } = await configurationFixture();
  await expect(t.query(api.configuration.read, { organizationId: ids.org })).rejects.toThrow("UNAUTHENTICATED");
  await expect(client.query(api.configuration.read, { organizationId: ids.otherOrg })).rejects.toThrow("ORGANIZATION_REQUIRED");
  await t.run((ctx) => ctx.db.patch(ids.member, { role: "viewer" }));
  await expect(client.mutation(api.configuration.saveOrganization, { ...base, name: "Changed", timezone: "UTC" })).rejects.toThrow("ACCESS_DENIED");
});
test("scoped admin cannot expand, rewrite another distributor's scope or mutate organization-wide products", async () => {
  const { client, ids, base } = await configurationFixture("administrator");
  const data = await client.query(api.configuration.read, { organizationId: ids.org }); expect(data.units.map((u) => u._id)).toEqual([ids.unit]); expect(data.distributors.map((d) => d._id)).toEqual([ids.distributor]);
  await expect(client.mutation(api.configuration.saveUnit, { ...base, name: "New", code: "NEW", active: true, type: "depot", workflows: ["returns"] })).rejects.toThrow("ALL_UNITS_REQUIRED");
  await expect(client.mutation(api.configuration.saveDistributor, { ...base, distributorId: ids.mixedDistributor, code: "D2", name: "Changed", active: true, operationalUnitIds: [ids.unit] })).rejects.toThrow("ACCESS_DENIED");
  await expect(client.mutation(api.configuration.saveProduct, { ...base, code: "NEW", name: "New", quantityUnit: "packs", active: true })).rejects.toThrow("ALL_UNITS_REQUIRED");
  await client.mutation(api.configuration.saveUnit, { ...base, unitId: ids.unit, name: "Reviewed unit", code: "ONE", active: true, type: "depot", workflows: ["returns"] });
});
test("master codes, quantity units and cross-tenant references are protected; parent cycles are rejected", async () => {
  const { client, ids, base } = await configurationFixture();
  const unit = { ...base, unitId: ids.unit, name: "Name", code: "ONE", active: true, type: "depot" as const, workflows: ["returns" as const] };
  await expect(client.mutation(api.configuration.saveUnit, { ...unit, parentId: ids.foreign })).rejects.toThrow("ACCESS_DENIED");
  await expect(client.mutation(api.configuration.saveUnit, { ...unit, parentId: ids.unit })).rejects.toThrow("UNIT_CYCLE");
  await expect(client.mutation(api.configuration.saveUnit, { ...unit, unitId: undefined })).rejects.toThrow("DUPLICATE_CODE");
  await expect(client.mutation(api.configuration.saveProduct, { ...base, productId: ids.product, name: "Name", code: "P1", quantityUnit: "tablets", active: true })).rejects.toThrow("PRODUCT_IDENTIFIERS_IMMUTABLE");
  await expect(client.mutation(api.configuration.saveOrganization, { ...base, name: "Name", timezone: "Bad/Zone" })).rejects.toThrow("INVALID_TIMEZONE");
});
test("master corrections retain previous configuration, while inactive scopes cannot acquire new policies", async () => {
  const { t, client, ids, base } = await configurationFixture();
  const args = { ...base, distributorId: ids.distributor, name: "Fictional Renamed Distributor", code: "D1", active: true, operationalUnitIds: [ids.unit] };
  await client.mutation(api.configuration.saveDistributor, args);
  await client.mutation(api.configuration.saveDistributor, { ...args, active: false, idempotencyKey: "deactivate-002" });
  const snapshots = await t.run((ctx) => ctx.db.query("configurationVersions").collect()); expect(snapshots).toHaveLength(2); expect(JSON.parse(snapshots[0].payloadJson).active).toBe(true); expect(JSON.parse(snapshots[1].payloadJson).active).toBe(false);
  await t.run((ctx) => ctx.db.patch(ids.unit, { active: false }));
  await expect(client.mutation(api.configuration.savePolicy, { ...base, idempotencyKey: "inactive-policy-003", operationalUnitId: ids.unit, effectiveFrom: "2026-01-01", code: "RET", rules: policy })).rejects.toThrow("ACCESS_DENIED");
});
test("policy revisions append, retries deduplicate, business dates select old versions and backdating cannot rewrite history", async () => {
  const { t, client, base, ids } = await configurationFixture();
  const args = { ...base, operationalUnitId: ids.unit, effectiveFrom: "2026-01-01", code: "RET", rules: policy };
  const first = await client.mutation(api.configuration.savePolicy, args); expect(await client.mutation(api.configuration.savePolicy, args)).toBe(first);
  await client.mutation(api.configuration.savePolicy, { ...args, effectiveFrom: "2026-07-01", idempotencyKey: "policy-v2-002", rules: { ...policy, deductionPercent: "10" } });
  const old = await client.query(api.configuration.effectivePolicy, { organizationId: ids.org, operationalUnitId: ids.unit, code: "RET", businessDate: "2026-06-30" }); expect(old?._id).toBe(first); expect(old?.rules.deductionPercent).toBe("0");
  expect((await client.query(api.configuration.effectivePolicy, { organizationId: ids.org, operationalUnitId: ids.unit, code: "RET", businessDate: "2026-07-01" }))?.rules.deductionPercent).toBe("10");
  await expect(client.mutation(api.configuration.savePolicy, { ...args, effectiveFrom: "2026-06-01", idempotencyKey: "backdated-003" })).rejects.toThrow("VERSION_DATE_MUST_ADVANCE");
  expect((await t.run((ctx) => ctx.db.get(first as Id<"policyVersions">)))?.version).toBe(1);
  expect(await t.run((ctx) => ctx.db.query("policyVersions").collect())).toHaveLength(2);
});
test("template, tolerance and deadline versions validate scope, dates, exact values and referenced report format", async () => {
  const { client, base, ids } = await configurationFixture();
  const version = { ...base, operationalUnitId: ids.unit, effectiveFrom: "2026-01-01" };
  const templateId = await client.mutation(api.configuration.saveTemplate, { ...version, evidenceType: "distributor_sales_stock", catalogVersion: "1" }) as Id<"templates">;
  await client.mutation(api.configuration.saveTolerance, { ...version, quantityAbsolute: "0.1", valuePaise: 1, idempotencyKey: "tolerance-001" });
  await expect(client.mutation(api.configuration.saveTolerance, { ...version, effectiveFrom: "2026-02-01", quantityAbsolute: "0", valuePaise: 0.5, idempotencyKey: "bad-money-001" })).rejects.toThrow("INVALID_PAISE");
  const deadline = { ...version, templateId, distributorId: ids.distributor, dueDayNextMonth: 7, timezone: "Asia/Kolkata", active: true, idempotencyKey: "deadline-001" };
  await client.mutation(api.configuration.saveObligation, deadline);
  await expect(client.mutation(api.configuration.saveObligation, { ...deadline, operationalUnitId: ids.denied, idempotencyKey: "wrong-scope-002" })).rejects.toThrow("ACCESS_DENIED");
  await expect(client.mutation(api.configuration.saveObligation, { ...deadline, dueDayNextMonth: 32, effectiveFrom: "2026-02-01", idempotencyKey: "bad-day-003" })).rejects.toThrow("INVALID_CONFIGURATION");
  expect((await client.query(api.configuration.read, { organizationId: ids.org })).obligations).toHaveLength(1);
});
test("aliases are distributor-scoped; batches and setup progress are persistent and audited", async () => {
  const { client, base, ids } = await configurationFixture();
  const alias = { ...base, productId: ids.product, distributorId: ids.distributor, alias: "LOCAL-001" };
  await client.mutation(api.configuration.saveAlias, alias);
  await expect(client.mutation(api.configuration.saveAlias, { ...alias, idempotencyKey: "alias-other-002" })).rejects.toThrow("ALIAS_ALREADY_EXISTS");
  await client.mutation(api.configuration.saveBatch, { ...base, productId: ids.product, batchNumber: "B-001", expiryDate: "2028-01-31", idempotencyKey: "batch-001" });
  await client.mutation(api.configuration.saveProgress, { ...base, step: "templates", idempotencyKey: "progress-001" });
  const data = await client.query(api.configuration.read, { organizationId: ids.org }); expect(data.progress).toBe("templates"); expect(data.aliases[0].alias).toBe("LOCAL-001"); expect(data.batches[0].expiryDate).toBe("2028-01-31");
});
test("sample seed requires explicit development opt-in, never runs in production, and retries cannot duplicate", async () => {
  const { t, client, base, ids } = await configurationFixture();
  await expect(client.mutation(api.configuration.seedFictional, base)).rejects.toThrow("DEVELOPMENT_ONLY");
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "production"); vi.stubEnv("PHARMAAI_ENABLE_FICTIONAL_SEED", "true"); vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://test.clerk.accounts.dev");
  await expect(client.mutation(api.configuration.seedFictional, base)).rejects.toThrow("DEVELOPMENT_ONLY");
  vi.stubEnv("PHARMAAI_ENVIRONMENT", "development");
  const id = await client.mutation(api.configuration.seedFictional, base); expect(await client.mutation(api.configuration.seedFictional, base)).toBe(id);
  const data = await client.query(api.configuration.read, { organizationId: ids.org }); expect(data.products.filter((p) => p.code === "FICTIONAL-001")).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("auditEvents").collect())).toHaveLength(3);
});
