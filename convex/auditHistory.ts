import { v } from "convex/values";
import { query } from "./_generated/server";
import { readScope } from "./lib/readScope";
import { date } from "./lib/contracts";
export const list = query({ args: { organizationId: v.id("organizations"), operationalUnitId: v.optional(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")), periodStart: v.optional(v.string()), periodEnd: v.optional(v.string()) }, handler: async (ctx, args) => { const actor = await readScope(ctx, args, "audit"); if (args.periodStart) date(args.periodStart); if (args.periodEnd) date(args.periodEnd); const global = actor.membership.allUnits === true && !args.operationalUnitId && !args.distributorId;
  const rows = await ctx.db.query("auditEvents").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(global ? q.eq(q.field("operationalUnitId"), undefined) : q.eq(false, true), ...actor.units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), args.distributorId ? q.eq(q.field("distributorId"), args.distributorId) : q.eq(true, true), args.periodStart ? q.gte(q.field("createdAt"), Date.parse(`${args.periodStart}T00:00:00Z`)) : q.eq(true, true), args.periodEnd ? q.lt(q.field("createdAt"), Date.parse(`${args.periodEnd}T00:00:00Z`) + 86400000) : q.eq(true, true))).order("desc").take(200);
  const result = []; for (const row of rows) { const user = row.actorUserId ? await ctx.db.get(row.actorUserId) : null; result.push({ ...row, actorName: user?.displayName ?? "System" }); } return result;
} });
