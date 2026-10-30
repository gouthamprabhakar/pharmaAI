import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { deny, permitsDistributor, permitsUnit, requireAccess } from "./authorization";
import { can, type Capability, type Role } from "./permissions";

export type EvidenceType = Doc<"submissions">["evidenceType"];
export function intakeCapability(type: EvidenceType, role: Role): Capability {
  if (type === "issued_credit_notes") return "credit";
  if (type === "distributor_return_claim") return "return_submit";
  if (type === "distributor_sales_stock") return "sales_submit";
  if (!["owner", "administrator", "data_operations", "inventory_control"].includes(role)) return deny();
  return "manufacturer_import";
}
export async function submissionAccess(ctx: QueryCtx, submission: Doc<"submissions">, write = false) {
  const actor = await requireAccess(ctx, submission);
  if (actor.membership.role === "distributor" && (!submission.distributorId || submission.distributorId !== actor.membership.distributorId)) return deny();
  if (write) await requireAccess(ctx, submission, intakeCapability(submission.evidenceType, actor.membership.role));
  return actor;
}
// Internal jobs inherit only the server-persisted submitter and recheck current
// grants before each step. Clients cannot choose or invoke these job authorities.
export async function jobAccess(ctx: Pick<QueryCtx, "db">, submission: Doc<"submissions">) {
  const user = await ctx.db.get(submission.submittedBy); const org = await ctx.db.get(submission.organizationId);
  const member = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", submission.submittedBy).eq("organizationId", submission.organizationId)).unique();
  if (!user?.active || !org?.active || !member?.active) return deny();
  const unit = await ctx.db.get(submission.operationalUnitId);
  if (!unit?.active || unit.organizationId !== org._id || !permitsUnit(member, unit._id)) return deny();
  const capability = intakeCapability(submission.evidenceType, member.role);
  if (!can(member.role, capability)) return deny();
  if (member.role === "distributor" && !submission.distributorId) return deny();
  if (submission.distributorId) {
    const distributor = await ctx.db.get(submission.distributorId);
    if (!distributor?.active || distributor.organizationId !== org._id || !permitsDistributor(member, distributor._id) || !distributor.operationalUnitIds?.includes(unit._id)) return deny();
  }
  return { user, organization: org, membership: member };
}
