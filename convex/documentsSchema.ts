import { defineTable } from "convex/server";
import { v } from "convex/values";
const scope = { organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), caseId: v.id("returnCases") };
export const documentsTables = {
  documentIntents: defineTable({ ...scope, fileName: v.string(), contentType: v.string(), sizeBytes: v.number(), actorUserId: v.id("users"), providedBy: v.union(v.literal("manufacturer"), v.literal("distributor")), createdAt: v.number(), expiresAt: v.number(), documentId: v.optional(v.id("documents")) }),
  documents: defineTable({ ...scope, storageId: v.id("_storage"), fileName: v.string(), contentType: v.string(), sizeBytes: v.number(), sha256: v.string(), uploadedBy: v.id("users"), workerActorId: v.id("users"), providedBy: v.union(v.literal("manufacturer"), v.literal("distributor")), status: v.union(v.literal("quarantined"), v.literal("scanning"), v.literal("clean"), v.literal("unsafe"), v.literal("blocked")), errorCode: v.optional(v.string()), leaseUntil: v.optional(v.number()), createdAt: v.number() }).index("by_case", ["caseId"]).index("by_storage", ["storageId"]),
  documentChecks: defineTable({ organizationId: v.id("organizations"), documentId: v.id("documents"), sha256: v.string(), verdict: v.union(v.literal("clean"), v.literal("unsafe")), patientDataDetected: v.boolean(), engine: v.string(), engineVersion: v.string(), createdAt: v.number() }).index("by_document", ["documentId"]),
};
