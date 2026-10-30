import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deny, permitsUnit, requireAccess } from "./lib/authorization";
import { canonicalJson, code, date, integer, invalid, selectEffective, text, timezone } from "./lib/contracts";
import { operation, configurationHistory } from "./lib/operations";
import { paise, quantity, rate } from "./lib/exact";
import { evidenceType, policyRules } from "./configurationSchema";
import { templateCatalog } from "./lib/templateCatalog";

const base = { organizationId: v.id("organizations"), reason: v.string(), idempotencyKey: v.string() };
const versionBase = { ...base, operationalUnitId: v.id("operationalUnits"), effectiveFrom: v.string() };
type Base = { organizationId: Id<"organizations">; reason: string; idempotencyKey: string };
async function begin(ctx: MutationCtx, args: Base, kind: string) {
  const access = await requireAccess(ctx, { organizationId: args.organizationId }, "configure");
  const reason = text(args.reason, 1000);
  if (reason.length < 3) return invalid("REASON_REQUIRED");
  const op = await operation(ctx, args.organizationId, access.user._id, args.idempotencyKey, { kind, ...args, idempotencyKey: undefined });
  return { ...access, op, reason };
}
async function unitGrant(ctx: MutationCtx, organizationId: Id<"organizations">, units: Id<"operationalUnits">[], existing = false) {
  const actor = await requireAccess(ctx, { organizationId }, "configure");
  if (units.length === 0 || new Set(units).size !== units.length || units.length > 100) return invalid("UNIT_REQUIRED");
  for (const operationalUnitId of units) {
    const unit = await ctx.db.get(operationalUnitId);
    if (!unit || unit.organizationId !== organizationId || !permitsUnit(actor.membership, unit._id) || (!existing && !unit.active)) return deny();
  }
}
const bounded = async <T>(rows: Promise<T[]>) => { const result = await rows; if (result.length > 2000) return invalid("CONFIGURATION_LIMIT_REACHED"); return result; };
export const read = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "configure");
    const [allUnits, allDistributors, products, templates, policies, tolerances, obligations, aliases, batches] = await Promise.all([
      bounded(ctx.db.query("operationalUnits").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("distributors").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("products").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("templates").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("policyVersions").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("toleranceVersions").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("reportingObligations").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("productAliases").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
      bounded(ctx.db.query("batches").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(2001)),
    ]);
    const units = allUnits.filter((u) => permitsUnit(actor.membership, u._id));
    const unitIds = new Set(units.map((u) => u._id));
    const distributors = allDistributors.filter((d) => d.operationalUnitIds?.length && d.operationalUnitIds.every((id) => unitIds.has(id)));
    const distributorIds = new Set(distributors.map((d) => d._id));
    return { organization: { id: actor.organization._id, name: actor.organization.name, timezone: actor.organization.timezone ?? null }, allUnits: actor.membership.allUnits === true, units, distributors, products, aliases: aliases.filter((a) => distributorIds.has(a.distributorId)), batches, templates: templates.filter((t) => unitIds.has(t.operationalUnitId)), policies: policies.filter((p) => unitIds.has(p.operationalUnitId)), tolerances: tolerances.filter((t) => unitIds.has(t.operationalUnitId)), obligations: obligations.filter((o) => unitIds.has(o.operationalUnitId) && distributorIds.has(o.distributorId)), progress: (await ctx.db.query("setupProgress").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).unique())?.step ?? "organization" };
  },
});

export const saveOrganization = mutation({
  args: { ...base, name: v.string(), timezone: v.string() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "organization");
    if (!actor.membership.allUnits) return deny();
    if (actor.op.priorId) return actor.op.priorId;
    const next = { name: text(args.name), timezone: timezone(args.timezone) };
    await ctx.db.patch(args.organizationId, next);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "organization", args.organizationId, actor.reason, next, { name: actor.organization.name, timezone: actor.organization.timezone });
    return actor.op.complete(args.organizationId);
  },
});
export const saveUnit = mutation({
  args: { ...base, unitId: v.optional(v.id("operationalUnits")), name: v.string(), code: v.string(), type: v.union(v.literal("division"), v.literal("region"), v.literal("depot"), v.literal("cf")), parentId: v.optional(v.id("operationalUnits")), workflows: v.array(v.union(v.literal("returns"), v.literal("sales_stock"), v.literal("reporting"))), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "unit");
    const old = args.unitId ? await ctx.db.get(args.unitId) : null;
    if (args.unitId && (!old || old.organizationId !== args.organizationId || !permitsUnit(actor.membership, args.unitId))) return deny();
    if (!old && !actor.membership.allUnits) return deny("ALL_UNITS_REQUIRED");
    if (args.parentId) { await unitGrant(ctx, args.organizationId, [args.parentId]); let parent: Id<"operationalUnits"> | undefined = args.parentId; const seen = new Set<string>(); while (parent) { if (parent === args.unitId || seen.has(parent)) return invalid("UNIT_CYCLE"); seen.add(parent); parent = (await ctx.db.get(parent))?.parentId; if (seen.size > 100) return invalid("UNIT_DEPTH"); } }
    if (actor.op.priorId) return actor.op.priorId;
    const normalizedCode = code(args.code);
    const duplicate = await ctx.db.query("operationalUnits").withIndex("by_code", (q) => q.eq("organizationId", args.organizationId).eq("code", normalizedCode)).unique();
    if (duplicate && duplicate._id !== args.unitId) return invalid("DUPLICATE_CODE");
    if (old && old.code !== normalizedCode) return invalid("CODE_IMMUTABLE");
    if (args.workflows.length === 0 || new Set(args.workflows).size !== args.workflows.length) return invalid("WORKFLOW_REQUIRED");
    const next = { organizationId: args.organizationId, name: text(args.name), code: normalizedCode, type: args.type, parentId: args.parentId, workflows: args.workflows, active: args.active };
    const id = old ? old._id : await ctx.db.insert("operationalUnits", next);
    if (old) await ctx.db.patch(id, next);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "unit", id, actor.reason, next, old, id);
    return actor.op.complete(id);
  },
});
export const saveDistributor = mutation({
  args: { ...base, distributorId: v.optional(v.id("distributors")), name: v.string(), code: v.string(), operationalUnitIds: v.array(v.id("operationalUnits")), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "distributor");
    const old = args.distributorId ? await ctx.db.get(args.distributorId) : null;
    if (args.distributorId && (!old || old.organizationId !== args.organizationId)) return deny();
    if (old) await unitGrant(ctx, args.organizationId, old.operationalUnitIds ?? [], true);
    await unitGrant(ctx, args.organizationId, args.operationalUnitIds);
    if (actor.op.priorId) return actor.op.priorId;
    const normalizedCode = code(args.code);
    const duplicate = await ctx.db.query("distributors").withIndex("by_organization_and_code", (q) => q.eq("organizationId", args.organizationId).eq("code", normalizedCode)).unique();
    if (duplicate && duplicate._id !== args.distributorId) return invalid("DUPLICATE_CODE");
    if (old && old.code !== normalizedCode) return invalid("CODE_IMMUTABLE");
    const next = { organizationId: args.organizationId, name: text(args.name), code: normalizedCode, operationalUnitIds: args.operationalUnitIds, active: args.active };
    const id = old ? old._id : await ctx.db.insert("distributors", next);
    if (old) await ctx.db.patch(id, next);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "distributor", id, actor.reason, next, old);
    return actor.op.complete(id);
  },
});
export const saveProduct = mutation({
  args: { ...base, productId: v.optional(v.id("products")), name: v.string(), code: v.string(), quantityUnit: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "product");
    if (!actor.membership.allUnits) return deny("ALL_UNITS_REQUIRED");
    const old = args.productId ? await ctx.db.get(args.productId) : null;
    if (args.productId && (!old || old.organizationId !== args.organizationId)) return deny();
    if (actor.op.priorId) return actor.op.priorId;
    const normalizedCode = code(args.code);
    const duplicate = await ctx.db.query("products").withIndex("by_organization_and_code", (q) => q.eq("organizationId", args.organizationId).eq("code", normalizedCode)).unique();
    if (duplicate && duplicate._id !== args.productId) return invalid("DUPLICATE_CODE");
    const next = { organizationId: args.organizationId, name: text(args.name), code: normalizedCode, quantityUnit: text(args.quantityUnit, 30), active: args.active };
    if (old && (old.code !== normalizedCode || old.quantityUnit !== next.quantityUnit)) return invalid("PRODUCT_IDENTIFIERS_IMMUTABLE");
    const id = old ? old._id : await ctx.db.insert("products", next);
    if (old) await ctx.db.patch(id, next);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "product", id, actor.reason, next, old);
    return actor.op.complete(id);
  },
});

export const savePolicy = mutation({
  args: { ...versionBase, code: v.string(), rules: policyRules },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "policy");
    await unitGrant(ctx, args.organizationId, [args.operationalUnitId]);
    if (actor.op.priorId) return actor.op.priorId;
    const policyCode = code(args.code); const effectiveFrom = date(args.effectiveFrom);
    const versions = await ctx.db.query("policyVersions").withIndex("by_policy", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("code", policyCode)).collect();
    if (versions.some((p) => p.effectiveFrom >= effectiveFrom)) return invalid("VERSION_DATE_MUST_ADVANCE");
    if (versions.some((p) => p.rules.dateBasis !== args.rules.dateBasis)) return invalid("POLICY_DATE_BASIS_IMMUTABLE");
    if (args.rules.allowedReasons.length === 0 || args.rules.allowedReasons.length > 30) return invalid();
    const rules = { ...args.rules, allowedReasons: [...new Set(args.rules.allowedReasons.map(code))], daysBeforeExpiry: integer(args.rules.daysBeforeExpiry, 0, 3650), daysAfterExpiry: integer(args.rules.daysAfterExpiry, 0, 3650), creditDueDays: integer(args.rules.creditDueDays, 0, 365), deductionPercent: rate(args.rules.deductionPercent).toFixed(), taxPercent: rate(args.rules.taxPercent).toFixed() };
    const next = { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, code: policyCode, rules, effectiveFrom, version: versions.length + 1, reason: actor.reason, createdBy: actor.user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("policyVersions", next);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "policy", id, actor.reason, next, null, args.operationalUnitId);
    return actor.op.complete(id);
  },
});
export const saveTolerance = mutation({
  args: { ...versionBase, quantityAbsolute: v.string(), valuePaise: v.number() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "tolerance"); await unitGrant(ctx, args.organizationId, [args.operationalUnitId]);
    if (actor.op.priorId) return actor.op.priorId;
    const effectiveFrom = date(args.effectiveFrom);
    const versions = await ctx.db.query("toleranceVersions").withIndex("by_unit", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId)).collect();
    if (versions.some((p) => p.effectiveFrom >= effectiveFrom)) return invalid("VERSION_DATE_MUST_ADVANCE");
    if (paise(args.valuePaise) < 0) return invalid();
    const next = { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, quantityAbsolute: quantity(args.quantityAbsolute), valuePaise: args.valuePaise, effectiveFrom, version: versions.length + 1, reason: actor.reason, createdBy: actor.user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("toleranceVersions", next); await configurationHistory(ctx, args.organizationId, actor.user._id, "tolerance", id, actor.reason, next, null, args.operationalUnitId); return actor.op.complete(id);
  },
});
export const saveTemplate = mutation({
  args: { ...versionBase, evidenceType, catalogVersion: v.literal("1") },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "template"); await unitGrant(ctx, args.organizationId, [args.operationalUnitId]);
    if (actor.op.priorId) return actor.op.priorId;
    const effectiveFrom = date(args.effectiveFrom);
    const versions = await ctx.db.query("templates").withIndex("by_type", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("evidenceType", args.evidenceType)).collect();
    if (versions.some((p) => p.effectiveFrom >= effectiveFrom)) return invalid("VERSION_DATE_MUST_ADVANCE");
    const next = { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, evidenceType: args.evidenceType, catalogVersion: args.catalogVersion, columnsJson: canonicalJson(templateCatalog[args.evidenceType]), effectiveFrom, version: versions.length + 1, reason: actor.reason, createdBy: actor.user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("templates", next); await configurationHistory(ctx, args.organizationId, actor.user._id, "template", id, actor.reason, next, null, args.operationalUnitId); return actor.op.complete(id);
  },
});
export const saveObligation = mutation({
  args: { ...versionBase, distributorId: v.id("distributors"), dueDayNextMonth: v.number(), timezone: v.string(), templateId: v.id("templates"), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "obligation"); await requireAccess(ctx, args, "configure");
    if (actor.op.priorId) return actor.op.priorId;
    const effectiveFrom = date(args.effectiveFrom);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.organizationId !== args.organizationId || template.operationalUnitId !== args.operationalUnitId || template.evidenceType !== "distributor_sales_stock" || template.effectiveFrom > effectiveFrom) return invalid("INVALID_REPORT_TEMPLATE");
    const versions = await ctx.db.query("reportingObligations").withIndex("by_distributor", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("distributorId", args.distributorId)).collect();
    if (versions.some((p) => p.effectiveFrom >= effectiveFrom)) return invalid("VERSION_DATE_MUST_ADVANCE");
    const next = { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, distributorId: args.distributorId, dueDayNextMonth: integer(args.dueDayNextMonth, 1, 28), timezone: timezone(args.timezone), templateId: args.templateId, active: args.active, effectiveFrom, version: versions.length + 1, reason: actor.reason, createdBy: actor.user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("reportingObligations", next); await configurationHistory(ctx, args.organizationId, actor.user._id, "obligation", id, actor.reason, next, null, args.operationalUnitId); return actor.op.complete(id);
  },
});
export const saveAlias = mutation({
  args: { ...base, distributorId: v.id("distributors"), productId: v.id("products"), alias: v.string() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "alias"); const distributor = await ctx.db.get(args.distributorId); const product = await ctx.db.get(args.productId);
    if (!distributor?.active || distributor.organizationId !== args.organizationId || !product?.active || product.organizationId !== args.organizationId) return deny();
    await unitGrant(ctx, args.organizationId, distributor.operationalUnitIds ?? []);
    if (actor.op.priorId) return actor.op.priorId;
    const alias = code(args.alias);
    const masterCode = await ctx.db.query("products").withIndex("by_organization_and_code", (q) => q.eq("organizationId", args.organizationId).eq("code", alias)).unique();
    if (masterCode && masterCode._id !== args.productId) return invalid("ALIAS_CONFLICTS_WITH_PRODUCT_CODE");
    if (await ctx.db.query("productAliases").withIndex("by_alias", (q) => q.eq("organizationId", args.organizationId).eq("distributorId", args.distributorId).eq("alias", alias)).unique()) return invalid("ALIAS_ALREADY_EXISTS");
    const next = { organizationId: args.organizationId, distributorId: args.distributorId, productId: args.productId, alias, createdBy: actor.user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("productAliases", next); await configurationHistory(ctx, args.organizationId, actor.user._id, "alias", id, actor.reason, next); return actor.op.complete(id);
  },
});
export const saveBatch = mutation({
  args: { ...base, productId: v.id("products"), batchNumber: v.string(), expiryDate: v.string() },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "batch"); if (!actor.membership.allUnits) return deny();
    const product = await ctx.db.get(args.productId); if (!product?.active || product.organizationId !== args.organizationId) return deny();
    if (actor.op.priorId) return actor.op.priorId;
    const batchNumber = code(args.batchNumber);
    if (await ctx.db.query("batches").withIndex("by_product_batch", (q) => q.eq("organizationId", args.organizationId).eq("productId", args.productId).eq("batchNumber", batchNumber)).unique()) return invalid("BATCH_ALREADY_EXISTS");
    const next = { organizationId: args.organizationId, productId: args.productId, batchNumber, expiryDate: date(args.expiryDate), createdBy: actor.user._id, createdAt: Date.now() };
    const id = await ctx.db.insert("batches", next); await configurationHistory(ctx, args.organizationId, actor.user._id, "batch", id, actor.reason, next); return actor.op.complete(id);
  },
});
export const saveProgress = mutation({
  args: { ...base, step: v.union(v.literal("organization"), v.literal("units"), v.literal("distributors"), v.literal("templates")) },
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "setup"); if (!actor.membership.allUnits) return deny();
    if (actor.op.priorId) return actor.op.priorId;
    const previous = await ctx.db.query("setupProgress").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).unique();
    const next = { organizationId: args.organizationId, step: args.step, updatedBy: actor.user._id, updatedAt: Date.now() };
    const id = previous ? previous._id : await ctx.db.insert("setupProgress", next); if (previous) await ctx.db.patch(id, next);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "setup", id, actor.reason, next, previous); return actor.op.complete(id);
  },
});
export const seedFictional = mutation({
  args: base,
  handler: async (ctx, args) => {
    const actor = await begin(ctx, args, "fictional_seed");
    if (process.env.PHARMAAI_ENVIRONMENT !== "development" || process.env.PHARMAAI_ENABLE_FICTIONAL_SEED !== "true" || !/^https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev\/?$/.test(process.env.CLERK_JWT_ISSUER_DOMAIN ?? "")) return deny("DEVELOPMENT_ONLY");
    if (!actor.membership.allUnits) return deny();
    if (actor.op.priorId) return actor.op.priorId;
    if (await ctx.db.query("operationalUnits").withIndex("by_code", (q) => q.eq("organizationId", args.organizationId).eq("code", "FICTIONAL-PILOT")).unique()) return invalid("SAMPLE_ALREADY_EXISTS");
    const unit = { organizationId: args.organizationId, code: "FICTIONAL-PILOT", name: "Fictional Pilot Depot", type: "depot" as const, workflows: ["returns", "sales_stock"] as ("returns" | "sales_stock")[], active: true };
    const unitId = await ctx.db.insert("operationalUnits", unit);
    const product = { organizationId: args.organizationId, code: "FICTIONAL-001", name: "Fictional Sample Product", quantityUnit: "packs", active: true };
    if (await ctx.db.query("products").withIndex("by_organization_and_code", (q) => q.eq("organizationId", args.organizationId).eq("code", product.code)).unique()) return invalid("SAMPLE_ALREADY_EXISTS");
    const productId = await ctx.db.insert("products", product);
    const distributor = { organizationId: args.organizationId, code: "FICTIONAL-D01", name: "Fictional Sample Distributor", operationalUnitIds: [unitId], active: true };
    if (await ctx.db.query("distributors").withIndex("by_organization_and_code", (q) => q.eq("organizationId", args.organizationId).eq("code", distributor.code)).unique()) return invalid("SAMPLE_ALREADY_EXISTS");
    const distributorId = await ctx.db.insert("distributors", distributor);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "unit", unitId, actor.reason, unit, null, unitId);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "product", productId, actor.reason, product);
    await configurationHistory(ctx, args.organizationId, actor.user._id, "distributor", distributorId, actor.reason, distributor);
    return actor.op.complete(unitId);
  },
});
export const effectivePolicy = query({
  args: { organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), code: v.string(), businessDate: v.string() },
  handler: async (ctx, args) => { await requireAccess(ctx, args, "return_review"); return selectEffective(await ctx.db.query("policyVersions").withIndex("by_policy", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("code", code(args.code))).collect(), args.businessDate); },
});
