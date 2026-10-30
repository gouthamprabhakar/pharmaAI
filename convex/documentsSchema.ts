import { defineTable } from "convex/server";
import { v } from "convex/values";
const scope = { organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), caseId: v.id("returnCases") };
export const documentsTables = {
  documentIntents: defineTable({ ...scope, fileName: v.string(), contentType: v.string(), sizeBytes: v.number(), actorUserId: v.id("users"), providedBy: v.union(v.literal("manufacturer"), v.literal("distributor")), createdAt: v.number(), expiresAt: v.number(), documentId: v.optional(v.id("documents")) }),
  documents: defineTable({ ...scope, storageId: v.id("_storage"), fileName: v.string(), contentType: v.string(), sizeBytes: v.number(), sha256: v.string(), uploadedBy: v.id("users"), providedBy: v.union(v.literal("manufacturer"), v.literal("distributor")), status: v.literal("available"), createdAt: v.number() }).index("by_case", ["caseId"]).index("by_storage", ["storageId"]),
};
