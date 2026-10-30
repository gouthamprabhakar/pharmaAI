import { defineTable } from "convex/server";
import { v } from "convex/values";

const scope = { organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors") };
export const stockTables = {
  stockReports: defineTable({ ...scope, sourceRowId: v.id("confirmedRows"), productId: v.id("products"), batchNumber: v.string(), periodStart: v.string(), periodEnd: v.string(), quantityUnit: v.string(), opening: v.string(), declaredReceipts: v.string(), onwardSales: v.string(), customerReturns: v.string(), manufacturerReturns: v.string(), transfersIn: v.string(), transfersOut: v.string(), damage: v.string(), reportedClosing: v.string(), createdAt: v.number() }).index("by_source", ["sourceRowId"]).index("by_scope", ["organizationId", "operationalUnitId", "distributorId", "productId", "batchNumber"]),
  stockBaselines: defineTable({ ...scope, varianceId: v.id("stockVariances"), quantity: v.string(), valuationRateInr: v.optional(v.string()), rounding: v.optional(v.union(v.literal("half_up"), v.literal("half_even"), v.literal("down"))), evidenceReference: v.string(), actorUserId: v.id("users"), reason: v.string(), createdAt: v.number() }).index("by_variance", ["varianceId"]),
  stockAdjustments: defineTable({ ...scope, varianceId: v.id("stockVariances"), quantity: v.string(), evidenceReference: v.string(), supersedesId: v.optional(v.id("stockAdjustments")), actorUserId: v.id("users"), reason: v.string(), createdAt: v.number() }).index("by_variance", ["varianceId"]),
  stockActions: defineTable({ ...scope, varianceId: v.id("stockVariances"), runId: v.id("reconciliationRuns"), action: v.union(v.literal("request_correction"), v.literal("escalate"), v.literal("resolve"), v.literal("carry_forward")), evidenceReference: v.string(), actorUserId: v.id("users"), reason: v.string(), createdAt: v.number() }).index("by_variance", ["varianceId"]),
  complianceWaivers: defineTable({ ...scope, periodStart: v.string(), periodEnd: v.string(), actorUserId: v.id("users"), reason: v.string(), createdAt: v.number() }).index("by_scope_period", ["organizationId", "operationalUnitId", "distributorId", "periodStart"]),
};
