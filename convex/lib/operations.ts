import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deny } from "./authorization";
import { canonicalJson, text } from "./contracts";

export async function operation(ctx: MutationCtx, organizationId: Id<"organizations">, actorUserId: Id<"users">, key: string, request: unknown) {
  if (text(key, 200).length < 8) return deny("INVALID_IDEMPOTENCY_KEY");
  const encoded = canonicalJson(request);
  const prior = await ctx.db.query("idempotencyKeys").withIndex("by_organization_key", (q) => q.eq("organizationId", organizationId).eq("key", key)).unique();
  if (prior && (prior.actorUserId !== actorUserId || prior.request !== encoded)) return deny("IDEMPOTENCY_CONFLICT");
  return {
    priorId: prior?.resultId,
    async complete(resultId: string) { await ctx.db.insert("idempotencyKeys", { organizationId, actorUserId, key, request: encoded, resultId, createdAt: Date.now() }); return resultId; },
  };
}
export async function configurationHistory(ctx: MutationCtx, organizationId: Id<"organizations">, actorUserId: Id<"users">, targetType: string, targetId: string, reason: string, after: unknown, before: unknown = null, operationalUnitId?: Id<"operationalUnits">) {
  const previous = await ctx.db.query("configurationVersions").withIndex("by_target", (q) => q.eq("organizationId", organizationId).eq("targetType", targetType).eq("targetId", targetId)).order("desc").first();
  await ctx.db.insert("configurationVersions", { organizationId, actorUserId, targetType, targetId, operationalUnitId, version: (previous?.version ?? 0) + 1, payloadJson: canonicalJson(after), reason, createdAt: Date.now() });
  await ctx.db.insert("auditEvents", { organizationId, actorUserId, targetType, targetId, action: `${targetType}.saved`, reason, beforeJson: canonicalJson(before), afterJson: canonicalJson(after), createdAt: Date.now() });
}
