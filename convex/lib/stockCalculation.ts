import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { activeSource, manufacturerSales } from "./businessSources";
import { canonicalJson, digest, invalid, selectEffective } from "./contracts";
import { decimal, expectedStock, quantityVariance, roundPaise, withinMoneyTolerance, withinQuantityTolerance, type StockInputs } from "./exact";
import { addDays } from "./calendar";
import { discrepancy } from "./discrepancy";
import { businessAudit } from "./businessAudit";

export type StockCalculation = { fingerprint: string; complete: boolean; issues: string[]; reportId: Id<"stockReports">; inputs: StockInputs; declaredOpening: string; declaredReceipts: string; reportedClosing: string; expectedClosing: string; variance: string; valuePaise: number | null; valuationRateInr: string | null; openingSource: string | null; toleranceId: Id<"toleranceVersions"> | null; withinTolerance: boolean; sourceIds: string[]; precision: "batch" | "product" };
export async function calculateStock(ctx: Pick<QueryCtx, "db">, item: Doc<"stockVariances">): Promise<StockCalculation> {
  if (!item.operationalUnitId || !item.sourceReportId || !item.periodStart || !item.periodEnd) return invalid("VARIANCE_SCOPE_REQUIRED");
  const report = await ctx.db.get(item.sourceReportId); if (!report) return invalid("REPORT_REQUIRED");
  const source = await ctx.db.get(report.sourceRowId); const issues: string[] = []; if (!source || !await activeSource(ctx, source)) issues.push("REPORT_REPLACED_OR_MISSING");
  const reports = await ctx.db.query("stockReports").withIndex("by_scope", (q) => q.eq("organizationId", item.organizationId).eq("operationalUnitId", item.operationalUnitId!).eq("distributorId", item.distributorId).eq("productId", item.productId)).filter((q) => q.and(q.eq(q.field("periodStart"), item.periodStart), q.eq(q.field("periodEnd"), item.periodEnd))).take(1001);
  if (reports.length > 1000) return invalid("PILOT_REPORT_LIMIT");
  const activeReports = []; for (const r of reports) { const s = await ctx.db.get(r.sourceRowId); if (s && await activeSource(ctx, s)) activeReports.push(r); }
  if (activeReports.some((r) => r._id !== report._id && (r.batchNumber === report.batchNumber || !r.batchNumber || !report.batchNumber))) issues.push("AMBIGUOUS_REPORT_PRECISION");
  const baselines = await ctx.db.query("stockBaselines").withIndex("by_variance", (q) => q.eq("varianceId", item._id)).order("desc").collect(); const baseline = baselines[0];
  const prior = await ctx.db.query("stockVariances").withIndex("by_organization", (q) => q.eq("organizationId", item.organizationId)).filter((q) => q.and(q.eq(q.field("operationalUnitId"), item.operationalUnitId), q.eq(q.field("distributorId"), item.distributorId), q.eq(q.field("productId"), item.productId), q.eq(q.field("batchNumber"), item.batchNumber ?? ""), q.eq(q.field("periodEnd"), addDays(item.periodStart!, -1)))).unique();
  let opening: string | undefined; let openingSource: string | null = null;
  if (prior?.latestRunId && !prior.incomplete && ["within_tolerance", "resolved"].includes(prior.status)) { const old = await ctx.db.get(prior.latestRunId); if (old) { const previous = JSON.parse(old.resultJson) as StockCalculation; const priorReport = await ctx.db.get(previous.reportId); const priorSource = priorReport ? await ctx.db.get(priorReport.sourceRowId) : null; if (priorSource && await activeSource(ctx, priorSource)) { opening = previous.reportedClosing; openingSource = old._id; } } }
  if (!opening && prior) issues.push("PREVIOUS_PERIOD_UNRESOLVED");
  if (!prior && baseline) { opening = baseline.quantity; openingSource = baseline._id; }
  if (opening === undefined) issues.push("OPENING_BASELINE_REQUIRED");
  if (opening !== undefined && !decimal(opening).eq(decimal(report.opening))) issues.push("DECLARED_OPENING_MISMATCH");
  const sales = (await manufacturerSales(ctx, item.organizationId, item.operationalUnitId, item.distributorId)).filter((s) => s.data.productId === item.productId && (!report.batchNumber || s.data.values.batch_number === report.batchNumber) && s.data.values.received_date >= item.periodStart! && s.data.values.received_date <= item.periodEnd!);
  const primaryEvidence = await ctx.db.query("submissions").withIndex("by_organization", (q) => q.eq("organizationId", item.organizationId)).filter((q) => q.and(q.eq(q.field("operationalUnitId"), item.operationalUnitId), q.eq(q.field("evidenceType"), "manufacturer_sales_shipments"), q.eq(q.field("status"), "accepted"), q.eq(q.field("projectionState"), "completed"), q.lte(q.field("periodStart"), item.periodStart!), q.gte(q.field("periodEnd"), item.periodEnd!), q.or(q.eq(q.field("distributorId"), item.distributorId), q.eq(q.field("distributorId"), undefined)))).first();
  if (!primaryEvidence) issues.push("MANUFACTURER_PERIOD_EVIDENCE_REQUIRED");
  const receipts = sales.reduce((sum, s) => sum.plus(decimal(s.data.values.quantity)), decimal("0")).toFixed();
  if (!decimal(receipts).eq(decimal(report.declaredReceipts))) issues.push("MANUFACTURER_RECEIPTS_MISMATCH");
  const allAdjustments = await ctx.db.query("stockAdjustments").withIndex("by_variance", (q) => q.eq("varianceId", item._id)).collect(); const superseded = new Set(allAdjustments.map((a) => a.supersedesId)); const adjustments = allAdjustments.filter((a) => !superseded.has(a._id));
  const inputs: StockInputs = { opening: opening ?? report.opening, receipts, customerReturns: report.customerReturns, transfersIn: report.transfersIn, onwardSales: report.onwardSales, manufacturerReturns: report.manufacturerReturns, damage: report.damage, transfersOut: report.transfersOut, approvedAdjustments: adjustments.reduce((s, a) => s.plus(decimal(a.quantity, true)), decimal("0")).toFixed() };
  const expectedClosing = expectedStock(inputs); if (decimal(expectedClosing, true).isNegative()) issues.push("NEGATIVE_EXPECTED_STOCK");
  const variance = quantityVariance(expectedClosing, report.reportedClosing);
  const tolerance = selectEffective(await ctx.db.query("toleranceVersions").withIndex("by_unit", (q) => q.eq("organizationId", item.organizationId).eq("operationalUnitId", item.operationalUnitId!)).collect(), item.periodEnd);
  if (!tolerance) issues.push("TOLERANCE_VERSION_REQUIRED");
  const valuePaise = issues.length === 0 && baseline?.valuationRateInr !== undefined && baseline.rounding ? roundPaise(decimal(variance, true).times(decimal(baseline.valuationRateInr)).times(100), baseline.rounding) : null;
  // Unknown value is never treated as zero. Nonzero tolerated variances need both configured limits.
  const withinTolerance = !!tolerance && withinQuantityTolerance(variance, tolerance.quantityAbsolute) && (decimal(variance, true).isZero() || (valuePaise !== null && withinMoneyTolerance(valuePaise, tolerance.valuePaise)));
  const complete = !issues.length;
  const sourceIds = [report.sourceRowId, ...sales.map((s) => s.record.sourceRowId), ...adjustments.map((a) => a._id), ...(openingSource ? [openingSource] : []), ...(baseline ? [baseline._id] : [])].sort();
  const result = { complete, issues, reportId: report._id, inputs, declaredOpening: report.opening, declaredReceipts: report.declaredReceipts, reportedClosing: report.reportedClosing, expectedClosing, variance, valuePaise, valuationRateInr: baseline?.valuationRateInr ?? null, openingSource, toleranceId: tolerance?._id ?? null, withinTolerance, sourceIds, precision: report.batchNumber ? "batch" as const : "product" as const };
  return { ...result, fingerprint: await digest(result) };
}
export async function storeStockRun(ctx: MutationCtx, item: Doc<"stockVariances">, actorUserId: Id<"users">, reason: string) {
  const result = await calculateStock(ctx, item); const previous = await ctx.db.query("reconciliationRuns").withIndex("by_fingerprint", (q) => q.eq("organizationId", item.organizationId).eq("kind", "sales").eq("targetId", item._id).eq("fingerprint", result.fingerprint)).unique();
  const id = previous?._id ?? await ctx.db.insert("reconciliationRuns", { organizationId: item.organizationId, operationalUnitId: item.operationalUnitId!, distributorId: item.distributorId, kind: "sales", targetId: item._id, fingerprint: result.fingerprint, ruleIds: result.toleranceId ? [result.toleranceId] : [], sourceIds: result.sourceIds, resultJson: canonicalJson(result), actorUserId, createdAt: Date.now() });
  const changed = item.latestRunId !== id;
  const priorAction = item.latestActionId ? await ctx.db.get(item.latestActionId) : null;
  const retainedStatus = priorAction?.runId === id ? item.status : undefined;
  await ctx.db.patch(item._id, { latestRunId: id, expectedClosingQuantity: result.expectedClosing, reportedClosingQuantity: result.reportedClosing, varianceQuantity: result.variance, varianceValuePaise: result.valuePaise ?? undefined, incomplete: !result.complete, issues: result.issues, status: retainedStatus ?? (result.complete && result.withinTolerance ? "within_tolerance" : "investigation_required"), calculationVersion: "stock-v1", updatedAt: Date.now() });
  await discrepancy(ctx, { organizationId: item.organizationId, operationalUnitId: item.operationalUnitId!, distributorId: item.distributorId }, actorUserId, "stock", "stock_variance", item._id, "STOCK_DIFFERENCE", !result.complete || !result.withinTolerance, result.valuePaise === null ? undefined : Math.abs(result.valuePaise));
  if (!previous || changed) await businessAudit(ctx, item.organizationId, actorUserId, "stock_variance", item._id, "stock.calculated", reason);
  return id;
}
