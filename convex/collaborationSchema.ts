import { defineTable } from "convex/server";
import { v } from "convex/values";
export const discussionTarget = v.union(v.literal("return_case"), v.literal("stock_variance"), v.literal("review_item"));
export const collaborationTables = {
  comments: defineTable({ organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), targetType: discussionTarget, targetId: v.string(), body: v.string(), supersedesId: v.optional(v.id("comments")), actorUserId: v.id("users"), createdAt: v.number() }).index("by_target", ["organizationId", "targetType", "targetId"]),
  attachments: defineTable({ organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), targetType: discussionTarget, targetId: v.string(), documentId: v.optional(v.id("documents")), submissionId: v.optional(v.id("submissions")), actorUserId: v.id("users"), reason: v.string(), createdAt: v.number() }).index("by_target", ["organizationId", "targetType", "targetId"]),
  notifications: defineTable({ organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), recipientId: v.id("users"), fingerprint: v.string(), code: v.string(), targetType: v.string(), targetId: v.string(), createdAt: v.number(), readAt: v.optional(v.number()) }).index("by_recipient", ["organizationId", "recipientId"]).index("by_fingerprint", ["organizationId", "recipientId", "fingerprint"]),
  notificationPreferences: defineTable({ organizationId: v.id("organizations"), userId: v.id("users"), inApp: v.boolean(), updatedAt: v.number() }).index("by_user", ["organizationId", "userId"]),
  maintenanceState: defineTable({ key: v.string(), updatedAt: v.number(), cursor: v.optional(v.string()) }).index("by_key", ["key"]),
};
