import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { businessDate } from "./lib/calendar";
import { discrepancy } from "./lib/discrepancy";
import { notify } from "./lib/reviewRouting";
import { selectEffective, fingerprint } from "./lib/contracts";

export const tick = internalMutation({ args: { cursor: v.optional(v.string()) }, handler: async (ctx, args) => { const page = await ctx.db.query("organizations").filter((q) => q.eq(q.field("active"), true)).paginate({ cursor: args.cursor ?? null, numItems: 10 }); for (const org of page.page) { const state = await ctx.db.query("maintenanceState").withIndex("by_key", (q) => q.eq("key", org._id)).unique(); if (state) await ctx.db.patch(state._id, { updatedAt: Date.now() }); else await ctx.db.insert("maintenanceState", { key: org._id, updatedAt: Date.now() }); await ctx.scheduler.runAfter(0, internal.deadlines.credits, { organizationId: org._id }); await ctx.scheduler.runAfter(0, internal.deadlines.reporting, { organizationId: org._id }); } if (!page.isDone) await ctx.scheduler.runAfter(0, internal.deadlines.tick, { cursor: page.continueCursor }); } });
export const credits = internalMutation({ args: { organizationId: v.id("organizations"), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const org = await ctx.db.get(args.organizationId); if (!org?.active) return; const page = await ctx.db.query("returnCases").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).paginate({ cursor: args.cursor ?? null, numItems: 25 });
  for (const item of page.page) { if (!item.operationalUnitId || !item.creditDueDate || !item.dueTimezone) continue; const unit = await ctx.db.get(item.operationalUnitId), distributor = await ctx.db.get(item.distributorId); if (!unit?.active || !distributor?.active) continue; const overdue = businessDate(Date.now(), item.dueTimezone) > item.creditDueDate && (item.approvedAmountPaise ?? 0) > item.issuedCreditAmountPaise;
    if (!overdue) continue; if (item.status !== "credit_overdue") await ctx.db.patch(item._id, { status: "credit_overdue", updatedAt: Date.now() }); const scope = { organizationId: org._id, operationalUnitId: unit._id, distributorId: distributor._id };
    const id = await discrepancy(ctx, scope, undefined, "finance", "return_case", item._id, "CREDIT_BALANCE", true, (item.approvedAmountPaise ?? 0) - item.issuedCreditAmountPaise);
    if (id) { const review = await ctx.db.query("reviewItems").withIndex("by_discrepancy", (q) => q.eq("discrepancyId", id)).unique(); if (review && review.dueAt === undefined) await ctx.db.patch(review._id, { dueAt: Date.now() - 1 }); }
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.deadlines.credits, { ...args, cursor: page.continueCursor });
} });
export const reporting = internalMutation({ args: { organizationId: v.id("organizations"), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const org = await ctx.db.get(args.organizationId); if (!org?.active) return; const page = await ctx.db.query("distributors").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.eq(q.field("active"), true)).paginate({ cursor: args.cursor ?? null, numItems: 10 });
  const members = await ctx.db.query("memberships").withIndex("by_organization", (q) => q.eq("organizationId", org._id)).collect();
  for (const d of page.page) for (const unitId of d.operationalUnitIds ?? []) {
    const unit = await ctx.db.get(unitId); if (!unit?.active) continue; const versions = await ctx.db.query("reportingObligations").withIndex("by_distributor", (q) => q.eq("organizationId", org._id).eq("operationalUnitId", unitId).eq("distributorId", d._id)).collect();
    const today = businessDate(Date.now(), org.timezone ?? "UTC"); const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    // Check the preceding twelve monthly periods, retaining unresolved earlier tasks.
    for (let age = 1; age <= 12; age++) { const start = new Date(Date.UTC(y, m - 1 - age, 1)).toISOString().slice(0, 10); const end = new Date(Date.UTC(y, m - age, 0)).toISOString().slice(0, 10); const obligation = selectEffective(versions, start); if (!obligation?.active) continue; const due = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), obligation.dueDayNextMonth)).toISOString().slice(0, 10); if (businessDate(Date.now(), obligation.timezone) <= due) continue;
      const submissions = await ctx.db.query("submissions").withIndex("by_distributor_and_period", (q) => q.eq("distributorId", d._id).eq("periodStart", start)).filter((q) => q.and(q.eq(q.field("organizationId"), org._id), q.eq(q.field("operationalUnitId"), unitId), q.eq(q.field("evidenceType"), "distributor_sales_stock"), q.eq(q.field("periodEnd"), end))).collect();
      const valid = submissions.some((s) => s.status === "accepted" && s.projectionState === "completed" && s.templateId === obligation.templateId && !!s.rowCount && s.acceptedRowIds?.length === s.rowCount); const waiver = await ctx.db.query("complianceWaivers").withIndex("by_scope_period", (q) => q.eq("organizationId", org._id).eq("operationalUnitId", unitId).eq("distributorId", d._id).eq("periodStart", start)).first();
      const sourceId = fingerprint("reporting_period", { unit: unitId, distributor: d._id, period: start }); const scope = { organizationId: org._id, operationalUnitId: unitId, distributorId: d._id }; const id = await discrepancy(ctx, scope, undefined, "data", "compliance", sourceId, "MONTHLY_REPORT_OVERDUE", !valid && !waiver);
      if (!valid && !waiver && id) { const review = await ctx.db.query("reviewItems").withIndex("by_discrepancy", (q) => q.eq("discrepancyId", id)).unique(); if (review && review.dueAt === undefined) await ctx.db.patch(review._id, { dueAt: Date.now() - 1 }); for (const member of members.filter((u) => u.active && u.role === "distributor" && u.distributorId === d._id)) await notify(ctx, scope, member.userId, `${sourceId}:${today}`, "MONTHLY_REPORT_OVERDUE", "compliance", sourceId); }
    }
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.deadlines.reporting, { ...args, cursor: page.continueCursor });
} });
