import { defineTable } from "convex/server";
import { v } from "convex/values";

export const evidenceType = v.union(v.literal("manufacturer_sales_shipments"), v.literal("distributor_return_claim"), v.literal("distributor_sales_stock"), v.literal("issued_credit_notes"));
export const rounding = v.union(v.literal("half_up"), v.literal("half_even"), v.literal("down"));
const versionBase = { organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), version: v.number(), effectiveFrom: v.string(), createdBy: v.id("users"), createdAt: v.number(), reason: v.string() };
export const policyRules = v.object({ dateBasis: v.union(v.literal("sale_date"), v.literal("return_date")), allowedReasons: v.array(v.string()), requiresReceipt: v.boolean(), daysBeforeExpiry: v.number(), daysAfterExpiry: v.number(), creditDueDays: v.number(), deductionPercent: v.string(), taxPercent: v.string(), rounding });
export const configurationTables = {
  configurationVersions: defineTable({ organizationId: v.id("organizations"), targetType: v.string(), targetId: v.string(), operationalUnitId: v.optional(v.id("operationalUnits")), version: v.number(), payloadJson: v.string(), actorUserId: v.id("users"), reason: v.string(), createdAt: v.number() }).index("by_target", ["organizationId", "targetType", "targetId"]).index("by_organization", ["organizationId"]),
  productAliases: defineTable({ organizationId: v.id("organizations"), distributorId: v.id("distributors"), productId: v.id("products"), alias: v.string(), createdBy: v.id("users"), createdAt: v.number() }).index("by_alias", ["organizationId", "distributorId", "alias"]).index("by_organization", ["organizationId"]),
  batches: defineTable({ organizationId: v.id("organizations"), productId: v.id("products"), batchNumber: v.string(), expiryDate: v.string(), createdBy: v.id("users"), createdAt: v.number() }).index("by_product_batch", ["organizationId", "productId", "batchNumber"]).index("by_organization", ["organizationId"]),
  templates: defineTable({ ...versionBase, evidenceType, catalogVersion: v.literal("1"), columnsJson: v.string() }).index("by_type", ["organizationId", "operationalUnitId", "evidenceType", "effectiveFrom"]).index("by_organization", ["organizationId"]),
  policyVersions: defineTable({ ...versionBase, code: v.string(), rules: policyRules }).index("by_policy", ["organizationId", "operationalUnitId", "code", "effectiveFrom"]).index("by_organization", ["organizationId"]),
  toleranceVersions: defineTable({ ...versionBase, quantityAbsolute: v.string(), valuePaise: v.number() }).index("by_unit", ["organizationId", "operationalUnitId", "effectiveFrom"]).index("by_organization", ["organizationId"]),
  reportingObligations: defineTable({ ...versionBase, distributorId: v.id("distributors"), dueDayNextMonth: v.number(), timezone: v.string(), templateId: v.id("templates"), active: v.boolean() }).index("by_distributor", ["organizationId", "operationalUnitId", "distributorId", "effectiveFrom"]).index("by_organization", ["organizationId"]),
  setupProgress: defineTable({ organizationId: v.id("organizations"), step: v.union(v.literal("organization"), v.literal("units"), v.literal("distributors"), v.literal("templates")), updatedBy: v.id("users"), updatedAt: v.number() }).index("by_organization", ["organizationId"]),
};
