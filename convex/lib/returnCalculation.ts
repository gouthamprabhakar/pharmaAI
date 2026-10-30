import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { activeReceipts, activeReturnLines, manufacturerSales } from "./businessSources";
import { decimal, lineAmounts, sumPaise } from "./exact";
import { digest, selectEffective } from "./contracts";
import { daysBetween } from "./calendar";

export type ReturnResultLine = { lineId: Id<"returnLines">; productId: Id<"products">; quantityUnit: string; submitted: string; received: string; receiptConfirmed: boolean; eligible: string; unitRate: string | null; expectedPaise: number | null; claimedPaise: number | null; grossPaise: number | null; deductionPaise: number | null; taxPaise: number | null; policyId: Id<"policyVersions"> | null; taxPercent: string | null; deductionPercent: string | null; rounding: "half_up" | "half_even" | "down" | null; creditDueDays: number | null; issues: string[]; sourceIds: string[] };
export type ReturnCalculation = { fingerprint: string; policyCode: string; complete: boolean; lines: ReturnResultLine[]; claimedPaise: number | null; eligiblePaise: number | null; sourceIds: string[]; policyIds: string[] };
export async function calculateReturn(ctx: Pick<QueryCtx, "db">, item: Doc<"returnCases">, policyCode: string): Promise<ReturnCalculation> {
  if (!item.operationalUnitId) throw new Error("CASE_SCOPE_REQUIRED");
  const lines = await activeReturnLines(ctx, item._id); const receipts = await activeReceipts(ctx, item._id);
  const sales = await manufacturerSales(ctx, item.organizationId, item.operationalUnitId, item.distributorId);
  const versions = await ctx.db.query("policyVersions").withIndex("by_policy", (q) => q.eq("organizationId", item.organizationId).eq("operationalUnitId", item.operationalUnitId!).eq("code", policyCode)).collect();
  const cases = await ctx.db.query("returnCases").withIndex("by_organization", (q) => q.eq("organizationId", item.organizationId)).collect();
  const result: ReturnResultLine[] = [];
  for (const line of lines) {
    const issues: string[] = []; const sourceIds: string[] = [line.sourceRowId, ...receipts.filter((r) => r.lines.some((l) => l.lineFingerprint === line.fingerprint)).map((r) => r._id)];
    const matches = sales.filter((s) => s.data.productId === line.productId && s.data.values.invoice_number === line.invoiceNumber && s.data.values.batch_number === line.batchNumber && s.data.values.received_date <= line.returnDate);
    sourceIds.push(...matches.map((s) => s.record._id));
    const received = receipts.reduce((n, r) => r.lines.filter((l) => l.lineFingerprint === line.fingerprint).reduce((sum, l) => sum.plus(decimal(l.quantity)), n), decimal("0"));
    let sold = decimal("0"); let previouslyApproved = decimal("0");
    for (const match of matches) sold = sold.plus(decimal(match.data.values.quantity));
    for (const other of cases) { if (other._id === item._id || other.distributorId !== item.distributorId || other.operationalUnitId !== item.operationalUnitId || !other.latestDecisionId) continue; const decision = await ctx.db.get(other.latestDecisionId); if (decision?.outcome !== "approved") continue; for (const approved of decision.approvedLines) { const original = await ctx.db.get(approved.returnLineId); if (original?.productId === line.productId && original.batchNumber === line.batchNumber && original.invoiceNumber === line.invoiceNumber) previouslyApproved = previouslyApproved.plus(decimal(approved.quantity)); } }
    if (!matches.length) issues.push("ORIGINAL_SALE_MISSING");
    if (new Set(matches.map((m) => `${m.data.values.unit_rate_inr}|${m.data.values.tax_percent}|${m.data.values.invoice_date}|${m.data.values.expiry_date}`)).size > 1) issues.push("AMBIGUOUS_ORIGINAL_SALE");
    const sale = matches[0]?.data; if (sale && sale.values.expiry_date !== line.expiryDate) issues.push("EXPIRY_DOES_NOT_MATCH_SALE");
    if (sale && line.returnDate < sale.values.invoice_date) issues.push("RETURN_BEFORE_SALE");
    const basis = versions[0]?.rules.dateBasis; const policy = basis === "return_date" ? selectEffective(versions, line.returnDate) : basis && sale ? selectEffective(versions, sale.values.invoice_date) : null;
    if (!policy) issues.push("APPLICABLE_POLICY_MISSING");
    if (policy?.rules.requiresReceipt && !receipts.some((r) => r.lines.some((l) => l.lineFingerprint === line.fingerprint))) issues.push("MANUFACTURER_RECEIPT_MISSING");
    const withinWindow = policy ? daysBetween(line.expiryDate, line.returnDate) >= -policy.rules.daysBeforeExpiry && daysBetween(line.expiryDate, line.returnDate) <= policy.rules.daysAfterExpiry : false;
    const allowed = policy?.rules.allowedReasons.includes(line.reason) === true && withinWindow;
    if (policy && !policy.rules.allowedReasons.includes(line.reason)) issues.push("REASON_NOT_ELIGIBLE"); if (policy && !withinWindow) issues.push("OUTSIDE_POLICY_EXPIRY_WINDOW");
    const stockAvailable = sold.minus(previouslyApproved); const cap = stockAvailable.isNegative() ? decimal("0") : stockAvailable;
    let eligible = decimal(line.quantity); if (eligible.gt(cap)) eligible = cap;
    if (policy?.rules.requiresReceipt && eligible.gt(received)) eligible = received;
    const missing = issues.some((issue) => ["ORIGINAL_SALE_MISSING", "AMBIGUOUS_ORIGINAL_SALE", "EXPIRY_DOES_NOT_MATCH_SALE", "RETURN_BEFORE_SALE", "APPLICABLE_POLICY_MISSING", "MANUFACTURER_RECEIPT_MISSING"].includes(issue));
    if (!allowed || missing) eligible = decimal("0");
    const claimed = sale && policy ? lineAmounts(line.quantity, sale.values.unit_rate_inr, sale.values.tax_percent, "0", policy.rules.rounding).totalPaise : null;
    const components = !missing && sale && policy ? lineAmounts(eligible.toFixed(), sale.values.unit_rate_inr, policy.rules.taxPercent, policy.rules.deductionPercent, policy.rules.rounding) : null;
    const expected = components?.totalPaise ?? null;
    if (decimal(line.quantity).gt(cap)) issues.push("QUANTITY_EXCEEDS_REMAINING_SALE"); if (policy?.rules.requiresReceipt && decimal(line.quantity).gt(received)) issues.push("CLAIM_RECEIPT_VARIANCE");
    result.push({ lineId: line._id, productId: line.productId, quantityUnit: line.quantityUnit, submitted: line.quantity, received: received.toFixed(), receiptConfirmed: receipts.some((r) => r.lines.some((l) => l.lineFingerprint === line.fingerprint)), eligible: eligible.toFixed(), unitRate: sale?.values.unit_rate_inr ?? null, expectedPaise: expected, claimedPaise: claimed, grossPaise: components?.grossPaise ?? null, deductionPaise: components?.deductionPaise ?? null, taxPaise: components?.taxPaise ?? null, policyId: policy?._id ?? null, taxPercent: policy?.rules.taxPercent ?? null, deductionPercent: policy?.rules.deductionPercent ?? null, rounding: policy?.rules.rounding ?? null, creditDueDays: policy?.rules.creditDueDays ?? null, issues, sourceIds });
  }
  const sourceIds = [...new Set(result.flatMap((r) => r.sourceIds))].sort(); const policyIds = [...new Set(result.flatMap((r) => r.policyId ? [r.policyId] : []))].sort();
  const complete = result.length > 0 && result.every((r) => r.expectedPaise !== null);
  return { fingerprint: await digest({ policyCode, sourceIds, policyIds, lines: result }), policyCode, complete, lines: result, claimedPaise: result.length && result.every((r) => r.claimedPaise !== null) ? sumPaise(result.map((r) => r.claimedPaise!)) : null, eligiblePaise: complete ? sumPaise(result.map((r) => r.expectedPaise!)) : null, sourceIds, policyIds };
}
