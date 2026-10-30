import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const timestamp = v.number();

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: timestamp,
  }).index("by_slug", ["slug"]),

  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    createdAt: timestamp,
  }).index("by_clerk_user", ["clerkUserId"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("administrator"),
      v.literal("returns_operations"),
      v.literal("finance"),
      v.literal("inventory_control"),
      v.literal("data_operations"),
      v.literal("distributor"),
      v.literal("viewer"),
    ),
    active: v.boolean(),
    createdAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_user_and_organization", ["userId", "organizationId"]),

  operationalUnits: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    active: v.boolean(),
  }).index("by_organization", ["organizationId"]),

  distributors: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    active: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_code", ["organizationId", "code"]),

  products: defineTable({
    organizationId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    active: v.boolean(),
  }).index("by_organization_and_code", ["organizationId", "code"]),

  submissions: defineTable({
    organizationId: v.id("organizations"),
    operationalUnitId: v.id("operationalUnits"),
    distributorId: v.optional(v.id("distributors")),
    evidenceType: v.union(
      v.literal("manufacturer_sales_shipments"),
      v.literal("distributor_return_claim"),
      v.literal("distributor_sales_stock"),
      v.literal("issued_credit_notes"),
    ),
    periodStart: v.string(),
    periodEnd: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("validating"),
      v.literal("correction_required"),
      v.literal("accepted"),
      v.literal("failed"),
    ),
    submittedBy: v.id("users"),
    createdAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_distributor_and_period", ["distributorId", "periodStart"]),

  evidenceFiles: defineTable({
    organizationId: v.id("organizations"),
    submissionId: v.optional(v.id("submissions")),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
    uploadedBy: v.id("users"),
    createdAt: timestamp,
  }).index("by_submission", ["submissionId"]),

  returnCases: defineTable({
    organizationId: v.id("organizations"),
    distributorId: v.id("distributors"),
    submissionId: v.id("submissions"),
    caseReference: v.string(),
    distributorReference: v.optional(v.string()),
    status: v.string(),
    claimedAmountPaise: v.number(),
    eligibleAmountPaise: v.optional(v.number()),
    issuedCreditAmountPaise: v.number(),
    ruleVersion: v.optional(v.string()),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_case_reference", ["organizationId", "caseReference"]),

  stockVariances: defineTable({
    organizationId: v.id("organizations"),
    distributorId: v.id("distributors"),
    submissionId: v.id("submissions"),
    productId: v.id("products"),
    batchNumber: v.optional(v.string()),
    expectedClosingQuantity: v.number(),
    reportedClosingQuantity: v.number(),
    varianceQuantity: v.number(),
    varianceValuePaise: v.number(),
    status: v.string(),
    calculationVersion: v.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_distributor", ["distributorId"]),

  reviewItems: defineTable({
    organizationId: v.id("organizations"),
    sourceType: v.union(v.literal("return_case"), v.literal("stock_variance"), v.literal("submission")),
    sourceId: v.string(),
    status: v.union(v.literal("open"), v.literal("waiting_on_distributor"), v.literal("resolved")),
    priority: v.union(v.literal("normal"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    assignedTeam: v.string(),
    assignedUserId: v.optional(v.id("users")),
    dueAt: v.optional(timestamp),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).index("by_organization_and_status", ["organizationId", "status"]),

  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    reason: v.optional(v.string()),
    beforeJson: v.optional(v.string()),
    afterJson: v.optional(v.string()),
    createdAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_target", ["targetType", "targetId"]),

  aiAssistances: defineTable({
    organizationId: v.id("organizations"),
    targetType: v.string(),
    targetId: v.string(),
    task: v.string(),
    model: v.string(),
    confidence: v.optional(v.number()),
    outputJson: v.string(),
    citationIds: v.array(v.string()),
    humanConfirmed: v.boolean(),
    createdAt: timestamp,
  }).index("by_target", ["targetType", "targetId"]),
});
