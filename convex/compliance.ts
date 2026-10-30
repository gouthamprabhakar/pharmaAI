import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "./_generated/server";
import { readScope } from "./lib/readScope";
import { date, invalid, selectEffective, text } from "./lib/contracts";
import { businessDate } from "./lib/calendar";
import { operation } from "./lib/operations";
import { businessAudit } from "./lib/businessAudit";
import type { StockFilters } from "./stock";
import { requireAccess } from "./lib/authorization";

export async function complianceRows(ctx: QueryCtx, args: StockFilters) {
  const actor = await readScope(ctx, args); await ctx.db.query("maintenanceState").withIndex("by_key", (q) => q.eq("key", args.organizationId)).unique(); const today = businessDate(Date.now(), actor.organization.timezone ?? "UTC");
  const start = args.periodStart ? date(args.periodStart) : `${today.slice(0, 7)}-01`; const end = args.periodEnd ? date(args.periodEnd) : today; if (start > end) return invalid("INVALID_PERIOD");
  let month = `${start.slice(0, 7)}-01`; const months: string[] = []; while (month <= end) { months.push(month); if (months.length > 24) return invalid("PILOT_PERIOD_LIMIT"); const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)); month = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); }
  const result = [];
  for (const unit of actor.units) for (const distributor of actor.distributors.filter((d) => d.operationalUnitIds?.includes(unit._id))) {
    const obligations = await ctx.db.query("reportingObligations").withIndex("by_distributor", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", unit._id).eq("distributorId", distributor._id)).collect();
    for (const periodStart of months) { const y = Number(periodStart.slice(0, 4)), m = Number(periodStart.slice(5, 7)); const periodEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); const obligation = selectEffective(obligations, periodStart); if (!obligation?.active) continue;
      const next = new Date(Date.UTC(y, m, obligation.dueDayNextMonth)).toISOString().slice(0, 10); const now = businessDate(Date.now(), obligation.timezone);
      const submissions = await ctx.db.query("submissions").withIndex("by_distributor_and_period", (q) => q.eq("distributorId", distributor._id).eq("periodStart", periodStart)).filter((q) => q.and(q.eq(q.field("organizationId"), args.organizationId), q.eq(q.field("operationalUnitId"), unit._id), q.eq(q.field("evidenceType"), "distributor_sales_stock"), q.eq(q.field("periodEnd"), periodEnd))).collect();
      const accepted = submissions.filter((s) => s.status === "accepted" && s.projectionState === "completed" && s.templateId === obligation.templateId && !!s.rowCount && s.acceptedRowIds?.length === s.rowCount).sort((a, b) => a.createdAt - b.createdAt)[0];
      const waiver = await ctx.db.query("complianceWaivers").withIndex("by_scope_period", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", unit._id).eq("distributorId", distributor._id).eq("periodStart", periodStart)).order("desc").first();
      const status = waiver ? "waived" : accepted ? businessDate(accepted.createdAt, obligation.timezone) <= next ? "on_time" : "late" : now > next ? submissions.length ? "non_compliant" : "overdue" : "not_due";
      result.push({ unitId: unit._id, distributorId: distributor._id, unitName: unit.name, distributorName: distributor.name, periodStart, periodEnd, dueDate: next, timezone: obligation.timezone, status, submissionId: accepted?._id, reason: waiver?.reason });
    }
  }
  if (result.length > 1000) return invalid("PILOT_COMPLIANCE_LIMIT"); return result;
}
export const list = query({ args: { organizationId: v.id("organizations"), operationalUnitId: v.optional(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")), periodStart: v.optional(v.string()), periodEnd: v.optional(v.string()) }, handler: complianceRows });
export const waive = mutation({ args: { organizationId: v.id("organizations"), operationalUnitId: v.id("operationalUnits"), distributorId: v.id("distributors"), periodStart: v.string(), periodEnd: v.string(), reason: v.string(), idempotencyKey: v.string() }, handler: async (ctx, args) => { const actor = await requireAccess(ctx, args, "configure"); date(args.periodStart); date(args.periodEnd); const y = Number(args.periodStart.slice(0, 4)), m = Number(args.periodStart.slice(5, 7)); if (!args.periodStart.endsWith("-01") || args.periodEnd !== new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)) return invalid("MONTHLY_PERIOD_REQUIRED"); const reason = text(args.reason, 1000); const op = await operation(ctx, args.organizationId, actor.user._id, args.idempotencyKey, { action: "compliance_waiver", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId; const id = await ctx.db.insert("complianceWaivers", { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, distributorId: args.distributorId, periodStart: args.periodStart, periodEnd: args.periodEnd, actorUserId: actor.user._id, reason, createdAt: Date.now() }); await businessAudit(ctx, args.organizationId, actor.user._id, "distributor", args.distributorId, "reporting.waived", reason); return op.complete(id); } });
