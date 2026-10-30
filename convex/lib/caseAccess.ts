import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { deny, requireRecordScope } from "./authorization";
import type { Capability } from "./permissions";
export async function caseAccess(ctx: QueryCtx, caseId: Id<"returnCases">, capability: Capability = "read") {
  const item = await ctx.db.get(caseId); if (!item?.operationalUnitId) return deny();
  const actor = await requireRecordScope(ctx, { organizationId: item.organizationId, operationalUnitId: item.operationalUnitId, distributorId: item.distributorId }, capability);
  return { item, ...actor };
}
