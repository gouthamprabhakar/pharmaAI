import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { canonicalJson } from "./contracts";
export async function businessAudit(ctx: MutationCtx, organizationId: Id<"organizations">, actorUserId: Id<"users">, targetType: string, targetId: string, action: string, reason: string, change?: { before: unknown; after: unknown }) {
  return ctx.db.insert("auditEvents", { organizationId, actorUserId, targetType, targetId, action, reason, beforeJson: change ? canonicalJson(change.before) : undefined, afterJson: change ? canonicalJson(change.after) : undefined, createdAt: Date.now() });
}
