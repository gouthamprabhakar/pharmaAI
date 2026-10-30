import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { configurationTables } from "./configurationSchema";
import { intakeTables } from "./intakeSchema";
import { returnsTables } from "./returnsSchema";
import { documentsTables } from "./documentsSchema";
import { aiTables } from "./aiSchema";
import { collaborationTables } from "./collaborationSchema";
import { stockTables } from "./stockSchema";

const timestamp = v.number();

export default defineSchema({
  organizations: defineTable({
    clerkOrganizationId: v.optional(v.string()),
    active: v.optional(v.boolean()),
    name: v.string(),
    slug: v.string(),
    timezone: v.optional(v.string()),
    createdAt: timestamp,
    providerUpdatedAt: v.optional(timestamp),
  }).index("by_slug", ["slug"]).index("by_clerk_organization", ["clerkOrganizationId"]),

  users: defineTable({
    active: v.optional(v.boolean()),
    clerkUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    createdAt: timestamp,
    providerUpdatedAt: v.optional(timestamp),
  }).index("by_clerk_user", ["clerkUserId"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("administrator"),
      v.literal("returns_operations"),
      v.literal("finance"),
      v.literal("inventory_control"),
      v.literal("data_operations"),
      v.literal("distributor"),
      v.literal("viewer"),
    ),
    active: v.boolean(),
    allUnits: v.optional(v.boolean()),
    operationalUnitIds: v.optional(v.array(v.id("operationalUnits"))),
    distributorId: v.optional(v.id("distributors")),
    exportGranted: v.optional(v.boolean()),
    createdAt: timestamp,
    providerUpdatedAt: v.optional(timestamp),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user_and_organization", ["userId", "organizationId"]),

  operationalUnits: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    active: v.boolean(),
    type: v.optional(v.union(v.literal("division"), v.literal("region"), v.literal("depot"), v.literal("cf"))),
    parentId: v.optional(v.id("operationalUnits")),
    workflows: v.optional(v.array(v.union(v.literal("returns"), v.literal("sales_stock"), v.literal("reporting")))),
  }).index("by_organization", ["organizationId"]).index("by_code", ["organizationId", "code"]),

  distributors: defineTable({
    operationalUnitIds: v.optional(v.array(v.id("operationalUnits"))),
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
    quantityUnit: v.optional(v.string()),
  }).index("by_organization_and_code", ["organizationId", "code"]).index("by_organization", ["organizationId"]),

  ...configurationTables,
  ...intakeTables,
  ...returnsTables,
  ...documentsTables,
  ...stockTables,
  ...collaborationTables,
  ...aiTables,

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
      v.literal("ready_for_confirmation"),
      v.literal("blocked"),
      v.literal("replaced"),
      v.literal("confirming"),
    ),
    submittedBy: v.id("users"),
    createdAt: timestamp,
    templateId: v.optional(v.id("templates")),
    mappingId: v.optional(v.id("importMappings")),
    fileName: v.optional(v.string()),
    sha256: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    supersedesId: v.optional(v.id("submissions")),
    rowCount: v.optional(v.number()),
    acceptedRowIds: v.optional(v.array(v.id("importRows"))),
    confirmedAt: v.optional(timestamp),
    projectionState: v.optional(v.union(v.literal("queued"), v.literal("processing"), v.literal("completed"), v.literal("blocked"))),
    projectionActorId: v.optional(v.id("users")),
    projectionCursor: v.optional(v.number()),
    projectionErrorCode: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_checksum", ["organizationId", "sha256"])
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
  }).index("by_submission", ["submissionId"]).index("by_storage", ["storageId"]),

  returnCases: defineTable({
    organizationId: v.id("organizations"),
    operationalUnitId: v.optional(v.id("operationalUnits")),
    distributorId: v.id("distributors"),
    submissionId: v.id("submissions"),
    caseReference: v.string(),
    distributorReference: v.optional(v.string()),
    returnDate: v.optional(v.string()),
    status: v.union(v.literal("submitted"), v.literal("evidence_processing"), v.literal("awaiting_eligibility_review"), v.literal("clarification_requested"), v.literal("rejected"), v.literal("approved_awaiting_credit"), v.literal("partially_credited"), v.literal("credit_overdue"), v.literal("confirmed_closed")),
    claimedAmountPaise: v.optional(v.number()),
    eligibleAmountPaise: v.optional(v.number()),
    issuedCreditAmountPaise: v.number(),
    ruleVersion: v.optional(v.string()),
    fingerprint: v.optional(v.string()),
    latestRunId: v.optional(v.id("reconciliationRuns")),
    latestDecisionId: v.optional(v.id("returnDecisions")),
    latestCreditMatchId: v.optional(v.id("creditMatches")),
    approvedAmountPaise: v.optional(v.number()),
    creditDueDate: v.optional(v.string()),
    dueTimezone: v.optional(v.string()),
    evidenceChanged: v.optional(v.boolean()),
    attention: v.optional(v.string()),
    assignedUserId: v.optional(v.id("users")),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_fingerprint", ["organizationId", "fingerprint"])
    .index("by_case_reference", ["organizationId", "caseReference"]),

  stockVariances: defineTable({
    organizationId: v.id("organizations"),
    operationalUnitId: v.optional(v.id("operationalUnits")),
    distributorId: v.id("distributors"),
    submissionId: v.id("submissions"),
    productId: v.id("products"),
    batchNumber: v.optional(v.string()),
    expectedClosingQuantity: v.string(),
    reportedClosingQuantity: v.string(),
    varianceQuantity: v.string(),
    varianceValuePaise: v.optional(v.number()),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    fingerprint: v.optional(v.string()),
    sourceReportId: v.optional(v.id("stockReports")),
    latestRunId: v.optional(v.id("reconciliationRuns")),
    latestActionId: v.optional(v.id("stockActions")),
    incomplete: v.optional(v.boolean()),
    issues: v.optional(v.array(v.string())),
    status: v.union(v.literal("calculated"), v.literal("within_tolerance"), v.literal("investigation_required"), v.literal("awaiting_distributor_correction"), v.literal("awaiting_internal_action"), v.literal("resolved"), v.literal("carried_forward")),
    calculationVersion: v.string(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_organization", ["organizationId"])
    .index("by_fingerprint", ["organizationId", "fingerprint"])
    .index("by_distributor", ["distributorId"]),

  reviewItems: defineTable({
    organizationId: v.id("organizations"),
    operationalUnitId: v.optional(v.id("operationalUnits")),
    distributorId: v.optional(v.id("distributors")),
    discrepancyId: v.optional(v.id("discrepancies")),
    fingerprint: v.optional(v.string()),
    code: v.optional(v.string()),
    conditionPresent: v.optional(v.boolean()),
    exposurePaise: v.optional(v.number()),
    recurrence: v.optional(v.number()),
    sourceType: v.union(v.literal("return_case"), v.literal("stock_variance"), v.literal("submission"), v.literal("credit_note"), v.literal("confirmed_row"), v.literal("compliance")),
    sourceId: v.string(),
    status: v.union(v.literal("open"), v.literal("waiting_on_distributor"), v.literal("resolved")),
    priority: v.union(v.literal("normal"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    assignedTeam: v.string(),
    assignedUserId: v.optional(v.id("users")),
    dueAt: v.optional(timestamp),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).index("by_organization_and_status", ["organizationId", "status"]).index("by_discrepancy", ["discrepancyId"]),

  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    operationalUnitId: v.optional(v.id("operationalUnits")),
    distributorId: v.optional(v.id("distributors")),
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

  invitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("administrator"), v.literal("returns_operations"), v.literal("finance"), v.literal("inventory_control"), v.literal("data_operations"), v.literal("distributor"), v.literal("viewer")),
    operationalUnitIds: v.array(v.id("operationalUnits")),
    distributorId: v.optional(v.id("distributors")),
    expiresAt: v.number(),
    status: v.union(v.literal("prepared"), v.literal("accepted"), v.literal("revoked")),
    createdBy: v.id("users"),
    acceptedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    deliveryState: v.optional(v.union(v.literal("queued"), v.literal("sending"), v.literal("checking"), v.literal("sent"), v.literal("unknown"), v.literal("revocation_pending"), v.literal("revoked"), v.literal("blocked"))),
    providerInvitationId: v.optional(v.string()),
    deliveryActorId: v.optional(v.id("users")),
    deliveryAuthorizedUntil: v.optional(timestamp),
    deliveryMfaVerified: v.optional(v.boolean()),
    deliveryAttempted: v.optional(v.boolean()),
  }).index("by_organization", ["organizationId"]).index("by_email", ["email"]).index("by_provider_invitation", ["providerInvitationId"]),

  idempotencyKeys: defineTable({
    organizationId: v.id("organizations"),
    key: v.string(),
    request: v.string(),
    resultId: v.string(),
    actorUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_organization_key", ["organizationId", "key"]),

  providerEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    subject: v.string(),
    occurredAt: timestamp,
    processedAt: timestamp,
    outcome: v.union(v.literal("applied"), v.literal("ignored")),
  }).index("by_event", ["eventId"]),

  revokedSessions: defineTable({
    sessionId: v.string(),
    revokedAt: timestamp,
  }).index("by_session", ["sessionId"]),
});
