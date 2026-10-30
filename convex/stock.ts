import { v } from "convex/values";
import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { activeSource } from "./lib/businessSources";
import { deny, requireRecordScope } from "./lib/authorization";
import { readScope } from "./lib/readScope";
import { jobAccess } from "./lib/intakeAccess";
import { date, fingerprint, invalid, text } from "./lib/contracts";
import { operation } from "./lib/operations";
import { quantity, decimal, sumPaise } from "./lib/exact";
import { calculateStock, storeStockRun, type StockCalculation } from "./lib/stockCalculation";
import { businessAudit } from "./lib/businessAudit";
import type { NormalizedRow } from "./lib/normalizeRow";
import { can } from "./lib/permissions";

export async function varianceAccess(ctx: QueryCtx, varianceId: Id<"stockVariances">, write = false) {
  const item = await ctx.db.get(varianceId); if (!item?.operationalUnitId) return deny();
  const actor = await requireRecordScope(ctx, item, write ? "sales_review" : "read"); return { ...actor, item };
}
export const projectSubmission = internalMutation({
  args: { submissionId: v.id("submissions"), actorUserId: v.id("users"), cursor: v.number() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || s.evidenceType !== "distributor_sales_stock") return { done: true, cursor: args.cursor }; await jobAccess(ctx, { ...s, submittedBy: args.actorUserId });
    const rows = await ctx.db.query("confirmedRows").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect();
    for (const row of rows.slice(args.cursor, args.cursor + 15)) {
      if (!await activeSource(ctx, row)) continue; const data = JSON.parse(row.normalizedJson) as NormalizedRow; const x = data.values;
      let report = await ctx.db.query("stockReports").withIndex("by_source", (q) => q.eq("sourceRowId", row._id)).unique();
      if (!report) { const id = await ctx.db.insert("stockReports", { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: data.distributorId, sourceRowId: row._id, productId: data.productId, batchNumber: x.batch_number ?? "", periodStart: x.period_start, periodEnd: x.period_end, quantityUnit: x.quantity_unit, opening: x.opening_stock, declaredReceipts: x.receipts, onwardSales: x.onward_sales, customerReturns: x.customer_returns, manufacturerReturns: x.manufacturer_returns, transfersIn: x.transfers_in, transfersOut: x.transfers_out, damage: x.damage, reportedClosing: x.reported_closing, createdAt: Date.now() }); report = await ctx.db.get(id); }
      if (!report) return invalid("REPORT_REQUIRED");
      const key = fingerprint("stock_variance", { unit: s.operationalUnitId, distributor: data.distributorId, product: data.productId, batch: x.batch_number ?? "", periodStart: x.period_start, periodEnd: x.period_end });
      let item = await ctx.db.query("stockVariances").withIndex("by_fingerprint", (q) => q.eq("organizationId", s.organizationId).eq("fingerprint", key)).unique();
      const fields = { submissionId: s._id, sourceReportId: report._id, updatedAt: Date.now() };
      if (item) { await ctx.db.patch(item._id, fields); item = await ctx.db.get(item._id); }
      else { const id = await ctx.db.insert("stockVariances", { ...fields, organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: data.distributorId, productId: data.productId, batchNumber: x.batch_number ?? "", periodStart: x.period_start, periodEnd: x.period_end, fingerprint: key, expectedClosingQuantity: "0", reportedClosingQuantity: report.reportedClosing, varianceQuantity: "0", status: "calculated", incomplete: true, calculationVersion: "stock-v1", createdAt: Date.now() }); item = await ctx.db.get(id); }
      if (item) await storeStockRun(ctx, item, args.actorUserId, "Accepted monthly report linked to its stable stock reconciliation");
    }
    const cursor = args.cursor + 15; return { done: cursor >= rows.length, cursor };
  },
});
const filters = { organizationId: v.id("organizations"), operationalUnitId: v.optional(v.id("operationalUnits")), distributorId: v.optional(v.id("distributors")), periodStart: v.optional(v.string()), periodEnd: v.optional(v.string()) };
export type StockFilters = { organizationId: Id<"organizations">; operationalUnitId?: Id<"operationalUnits">; distributorId?: Id<"distributors">; periodStart?: string; periodEnd?: string };
export async function stockRows(ctx: QueryCtx, args: StockFilters) {
  const actor = await readScope(ctx, args); if (args.periodStart) date(args.periodStart); if (args.periodEnd) date(args.periodEnd); if (!actor.units.length || !actor.distributors.length) return { actor, rows: [] };
  const records = await ctx.db.query("stockVariances").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(...actor.units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), q.or(...actor.distributors.map((d) => q.eq(q.field("distributorId"), d._id))), args.periodStart ? q.gte(q.field("periodEnd"), args.periodStart) : q.eq(true, true), args.periodEnd ? q.lte(q.field("periodStart"), args.periodEnd) : q.eq(true, true))).order("desc").take(1001);
  if (records.length > 1000) return invalid("PILOT_VARIANCE_LIMIT"); const rows = [];
  for (const item of records) { const product = await ctx.db.get(item.productId); rows.push({ ...item, productName: product?.name ?? "Unknown product", quantityUnit: product?.quantityUnit ?? "units", distributorName: actor.distributors.find((d) => d._id === item.distributorId)?.name ?? "Distributor" }); }
  return { actor, rows };
}
export const list = query({ args: filters, handler: async (ctx, args) => { const { actor, rows } = await stockRows(ctx, args); const projected = rows.map((r) => actor.membership.role === "distributor" ? { id: r._id, productName: r.productName, batch: r.batchNumber, period: `${r.periodStart} – ${r.periodEnd}`, distributorName: r.distributorName, quantityUnit: r.quantityUnit, status: r.status, incomplete: r.incomplete } : { id: r._id, productName: r.productName, batch: r.batchNumber, period: `${r.periodStart} – ${r.periodEnd}`, distributorName: r.distributorName, quantityUnit: r.quantityUnit, status: r.status, incomplete: r.incomplete, expected: r.expectedClosingQuantity, reported: r.reportedClosingQuantity, variance: r.varianceQuantity, valuePaise: r.varianceValuePaise }); return { rows: projected, metrics: { reportLines: new Set(rows.map((r) => r.submissionId)).size, open: rows.filter((r) => !["within_tolerance", "resolved"].includes(r.status)).length, valuePaise: actor.membership.role === "distributor" ? undefined : sumPaise(rows.filter((r) => !["within_tolerance", "resolved"].includes(r.status)).flatMap((r) => r.varianceValuePaise === undefined ? [] : [Math.abs(r.varianceValuePaise)])), unvalued: rows.filter((r) => r.varianceValuePaise === undefined && r.varianceQuantity !== "0").length } }; } });
export const detail = query({ args: { varianceId: v.id("stockVariances") }, handler: async (ctx, args) => {
  const actor = await varianceAccess(ctx, args.varianceId); const product = await ctx.db.get(actor.item.productId); if (actor.membership.role === "distributor") return { restricted: true as const, item: { id: actor.item._id, status: actor.item.status, period: `${actor.item.periodStart} – ${actor.item.periodEnd}`, product: product?.name }, submissionId: actor.item.submissionId };
  const run = actor.item.latestRunId ? await ctx.db.get(actor.item.latestRunId) : null; const history = await ctx.db.query("auditEvents").withIndex("by_target", (q) => q.eq("targetType", "stock_variance").eq("targetId", args.varianceId)).order("desc").take(100);
  const calculation = run ? JSON.parse(run.resultJson) as StockCalculation : null; const sources = []; for (const id of calculation?.sourceIds ?? []) { const rowId = ctx.db.normalizeId("confirmedRows", id); if (!rowId) continue; const row = await ctx.db.get(rowId); if (row?.organizationId === actor.item.organizationId) sources.push({ id: row._id, submissionId: row.submissionId }); }
  return { restricted: false as const, item: actor.item, productName: product?.name ?? "Product", quantityUnit: product?.quantityUnit ?? "units", calculation, runId: run?._id, history, sources, adjustments: await ctx.db.query("stockAdjustments").withIndex("by_variance", (q) => q.eq("varianceId", args.varianceId)).collect(), canReview: can(actor.membership.role, "sales_review") };
} });
export const reconcile = mutation({ args: { varianceId: v.id("stockVariances"), reason: v.string(), idempotencyKey: v.string() }, handler: async (ctx, args) => { const actor = await varianceAccess(ctx, args.varianceId, true); const reason = text(args.reason, 1000); const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "stock_reconcile", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId; return op.complete(await storeStockRun(ctx, actor.item, actor.user._id, reason)); } });
export const baseline = mutation({ args: { varianceId: v.id("stockVariances"), quantity: v.string(), valuationRateInr: v.optional(v.string()), rounding: v.optional(v.union(v.literal("half_up"), v.literal("half_even"), v.literal("down"))), evidenceReference: v.string(), reason: v.string(), idempotencyKey: v.string() }, handler: async (ctx, args) => { const actor = await varianceAccess(ctx, args.varianceId, true); const reason = text(args.reason, 1000); const evidenceReference = text(args.evidenceReference, 300); const qty = quantity(args.quantity); if (args.valuationRateInr !== undefined) { quantity(args.valuationRateInr); if (!args.rounding) return invalid("ROUNDING_REQUIRED"); }
  const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "stock_baseline", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
  const id = await ctx.db.insert("stockBaselines", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, varianceId: actor.item._id, quantity: qty, valuationRateInr: args.valuationRateInr, rounding: args.rounding, evidenceReference, actorUserId: actor.user._id, reason, createdAt: Date.now() }); await businessAudit(ctx, actor.item.organizationId, actor.user._id, "stock_variance", actor.item._id, "stock.baseline_confirmed", reason); await storeStockRun(ctx, actor.item, actor.user._id, reason); return op.complete(id);
} });
export const adjust = mutation({ args: { varianceId: v.id("stockVariances"), quantity: v.string(), evidenceReference: v.string(), supersedesId: v.optional(v.id("stockAdjustments")), reason: v.string(), idempotencyKey: v.string() }, handler: async (ctx, args) => {
  const actor = await varianceAccess(ctx, args.varianceId, true); const qty = quantity(args.quantity, true); const reason = text(args.reason, 1000); const evidenceReference = text(args.evidenceReference, 300); if (decimal(qty, true).isZero() && !args.supersedesId) return invalid("NONZERO_ADJUSTMENT_REQUIRED");
  const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "stock_adjust", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
  if (args.supersedesId) { const old = await ctx.db.get(args.supersedesId); const all = await ctx.db.query("stockAdjustments").withIndex("by_variance", (q) => q.eq("varianceId", args.varianceId)).collect(); if (!old || old.varianceId !== args.varianceId || all.some((a) => a.supersedesId === old._id)) return invalid("ADJUSTMENT_ALREADY_SUPERSEDED"); }
  const id = await ctx.db.insert("stockAdjustments", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, varianceId: actor.item._id, quantity: qty, evidenceReference, supersedesId: args.supersedesId, actorUserId: actor.user._id, reason, createdAt: Date.now() }); await businessAudit(ctx, actor.item.organizationId, actor.user._id, "stock_variance", args.varianceId, "stock.adjustment_approved", reason); await storeStockRun(ctx, actor.item, actor.user._id, reason); return op.complete(id);
} });
export const decide = mutation({ args: { varianceId: v.id("stockVariances"), runId: v.id("reconciliationRuns"), action: v.union(v.literal("request_correction"), v.literal("escalate"), v.literal("resolve"), v.literal("carry_forward")), evidenceReference: v.string(), reason: v.string(), idempotencyKey: v.string() }, handler: async (ctx, args) => {
  const actor = await varianceAccess(ctx, args.varianceId, true); const reason = text(args.reason, 1000); const evidenceReference = text(args.evidenceReference, 300); const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { operation: "stock_decision", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
  const run = await ctx.db.get(args.runId); const current = await calculateStock(ctx, actor.item); if (actor.item.latestRunId !== args.runId || run?.fingerprint !== current.fingerprint) return invalid("RECALCULATE_REQUIRED"); if (args.action === "resolve" && !current.complete) return invalid("INCOMPLETE_EVIDENCE");
  const status = args.action === "request_correction" ? "awaiting_distributor_correction" : args.action === "escalate" ? "awaiting_internal_action" : args.action === "carry_forward" ? "carried_forward" : "resolved";
  const id = await ctx.db.insert("stockActions", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, varianceId: actor.item._id, runId: args.runId, action: args.action, evidenceReference, actorUserId: actor.user._id, reason, createdAt: Date.now() }); await ctx.db.patch(args.varianceId, { status, latestActionId: id, updatedAt: Date.now() }); await businessAudit(ctx, actor.item.organizationId, actor.user._id, "stock_variance", args.varianceId, `stock.${args.action}`, reason, { before: { status: actor.item.status }, after: { status, actionId: id } }); return op.complete(id);
} });
