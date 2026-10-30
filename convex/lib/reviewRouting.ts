import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { can, type Role } from "./permissions";
import { permitsUnit, permitsDistributor } from "./authorization";
import { businessAudit } from "./businessAudit";
export function teamFor(category: string) { return category === "finance" ? "Finance" : category === "stock" ? "Inventory" : category === "returns" ? "Returns" : "Data operations"; }
export function managesTeam(role: Role, team: string) { return role === "owner" || role === "administrator" || (team === "Finance" && can(role, "credit")) || (team === "Inventory" && can(role, "sales_review")) || (team === "Returns" && can(role, "return_review")) || (team === "Data operations" && role === "data_operations"); }
export async function notify(ctx: MutationCtx, scope: { organizationId: Id<"organizations">; operationalUnitId: Id<"operationalUnits">; distributorId: Id<"distributors"> }, recipientId: Id<"users">, fingerprint: string, code: string, targetType: string, targetId: string) {
  const member = await ctx.db.query("memberships").withIndex("by_user_and_organization", (q) => q.eq("userId", recipientId).eq("organizationId", scope.organizationId)).unique(); const user = await ctx.db.get(recipientId);
  if (!user?.active || !member?.active || !permitsUnit(member, scope.operationalUnitId) || !permitsDistributor(member, scope.distributorId)) return;
  const preferences = await ctx.db.query("notificationPreferences").withIndex("by_user", (q) => q.eq("organizationId", scope.organizationId).eq("userId", recipientId)).unique(); if (preferences?.inApp === false) return;
  if (!await ctx.db.query("notifications").withIndex("by_fingerprint", (q) => q.eq("organizationId", scope.organizationId).eq("recipientId", recipientId).eq("fingerprint", fingerprint)).unique()) await ctx.db.insert("notifications", { ...scope, recipientId, fingerprint, code, targetType, targetId, createdAt: Date.now() });
}
export async function syncReview(ctx: MutationCtx, d: Doc<"discrepancies">, actor: Id<"users"> | undefined) {
  const old = await ctx.db.query("reviewItems").withIndex("by_discrepancy", (q) => q.eq("discrepancyId", d._id)).unique(); const sourceType = ["return_case", "stock_variance", "submission", "credit_note", "confirmed_row", "compliance"].includes(d.sourceType) ? d.sourceType as Doc<"reviewItems">["sourceType"] : "submission";
  const table = d.sourceType === "return_case" ? "returnCases" : d.sourceType === "stock_variance" ? "stockVariances" : d.sourceType === "credit_note" ? "creditNotes" : d.sourceType === "confirmed_row" ? "confirmedRows" : "submissions";
  const parentId = ctx.db.normalizeId(table, d.sourceId); let parent: Record<string, unknown> | null = parentId ? await ctx.db.get(parentId) : null;
  if (d.sourceType === "confirmed_row" && parent) { const id = ctx.db.normalizeId("submissions", String(parent.submissionId)); parent = id ? await ctx.db.get(id) : null; }
  const reportingPeriod = d.sourceType === "compliance" ? d.sourceId.match(/"period":"(\d{4}-\d{2}-\d{2})"/)?.[1] : undefined;
  const periodStart = typeof parent?.returnDate === "string" ? parent.returnDate : typeof parent?.issuedDate === "string" ? parent.issuedDate : typeof parent?.periodStart === "string" ? parent.periodStart : reportingPeriod;
  const periodEnd = typeof parent?.periodEnd === "string" ? parent.periodEnd : reportingPeriod ? new Date(Date.UTC(Number(reportingPeriod.slice(0,4)), Number(reportingPeriod.slice(5,7)),0)).toISOString().slice(0,10) : periodStart;
  const fields = { periodStart, periodEnd, organizationId: d.organizationId, operationalUnitId: d.operationalUnitId, distributorId: d.distributorId, discrepancyId: d._id, fingerprint: d.fingerprint, code: d.code, conditionPresent: d.conditionPresent, exposurePaise: d.exposurePaise, recurrence: d.recurrence, sourceType, sourceId: d.sourceId, assignedTeam: teamFor(d.category), updatedAt: Date.now() };
  const reopened = !!old && old.status === "resolved" && !d.resolved && d.conditionPresent;
  const id = old?._id ?? await ctx.db.insert("reviewItems", { ...fields, status: "open", priority: "normal", createdAt: Date.now() });
  if (old) await ctx.db.patch(id, { ...fields, status: reopened ? "open" : old.status });
  if (!old || reopened) { await businessAudit(ctx, d.organizationId, actor, "review_item", id, reopened ? "review.reopened" : "review.created", d.code); const members = await ctx.db.query("memberships").withIndex("by_organization", (q) => q.eq("organizationId", d.organizationId)).collect(); for (const member of members.filter((m) => m.active && managesTeam(m.role, fields.assignedTeam))) await notify(ctx, d, member.userId, `${d._id}:${d.recurrence}`, d.code, "review_item", id); }
  return id;
}
