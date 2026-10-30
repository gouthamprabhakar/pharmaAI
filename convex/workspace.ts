import { v } from "convex/values";
import { query } from "./_generated/server";
import { permitsDistributor, permitsUnit, requireAccess } from "./lib/authorization";

export const filters = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args);
    const units = (await ctx.db.query("operationalUnits").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((u) => u.active && permitsUnit(actor.membership, u._id));
    const distributors = (await ctx.db.query("distributors").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((d) => d.active && permitsDistributor(actor.membership, d._id) && d.operationalUnitIds?.some((id) => units.some((u) => u._id === id)));
    const submissions = units.length ? await ctx.db.query("submissions").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(...units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), actor.membership.role === "distributor" ? q.eq(q.field("distributorId"), actor.membership.distributorId) : q.eq(true, true))).order("desc").take(1000) : [];
    const now = new Date(); const monthlyPeriods = Array.from({length: 13}, (_, i) => { const y = now.getUTCFullYear(), m = now.getUTCMonth() - i; return `${new Date(Date.UTC(y,m,1)).toISOString().slice(0,10)}|${new Date(Date.UTC(y,m+1,0)).toISOString().slice(0,10)}`; });
    return { units: units.map((u) => ({ id: u._id, name: u.name })), distributors: distributors.map((d) => ({ id: d._id, name: d.name, unitIds: d.operationalUnitIds ?? [] })), periods: [...new Set([...monthlyPeriods, ...submissions.map((s) => `${s.periodStart}|${s.periodEnd}`)])].sort().reverse().map((value) => ({ value, label: value.replace("|", " – ") })) };
  },
});
