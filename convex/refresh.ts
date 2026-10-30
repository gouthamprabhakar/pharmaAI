import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { jobAccess } from "./lib/intakeAccess";
import { internalActor } from "./lib/internalActor";
import { matchCaseCredits } from "./lib/creditMatching";
import { storeStockRun } from "./lib/stockCalculation";

// Bounded follow-up work. Persisted actor is reauthorized on every page.
export const sources = internalMutation({ args: { submissionId: v.id("submissions"), kind: v.union(v.literal("returns"), v.literal("stock")), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || !s.projectionActorId) return; await jobAccess(ctx, { ...s, submittedBy: s.projectionActorId });
  if (args.kind === "returns") {
    const page = await ctx.db.query("returnCases").withIndex("by_organization", (q) => q.eq("organizationId", s.organizationId)).filter((q) => q.and(q.eq(q.field("operationalUnitId"), s.operationalUnitId), s.distributorId ? q.eq(q.field("distributorId"), s.distributorId) : q.eq(true, true))).paginate({ cursor: args.cursor ?? null, numItems: 15 });
    for (const item of page.page) { await internalActor(ctx, { organizationId: item.organizationId, operationalUnitId: item.operationalUnitId, distributorId: item.distributorId }, s.projectionActorId, "read"); await ctx.db.patch(item._id, { evidenceChanged: true }); if (item.latestDecisionId) await matchCaseCredits(ctx, item._id, s.projectionActorId); }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.refresh.sources, { ...args, cursor: page.continueCursor });
  } else {
    const page = await ctx.db.query("stockVariances").withIndex("by_organization", (q) => q.eq("organizationId", s.organizationId)).filter((q) => q.and(q.eq(q.field("operationalUnitId"), s.operationalUnitId), s.distributorId ? q.eq(q.field("distributorId"), s.distributorId) : q.eq(true, true))).paginate({ cursor: args.cursor ?? null, numItems: 10 });
    for (const item of page.page) { if (!item.sourceReportId) continue; await internalActor(ctx, { organizationId: item.organizationId, operationalUnitId: item.operationalUnitId, distributorId: item.distributorId }, s.projectionActorId, "read"); await storeStockRun(ctx, item, s.projectionActorId, "Source evidence changed; current stock calculation refreshed"); }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.refresh.sources, { ...args, cursor: page.continueCursor });
  }
} });
