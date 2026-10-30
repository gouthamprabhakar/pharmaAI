import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { NormalizedRow } from "./normalizeRow";
import { invalid } from "./contracts";

export async function activeSource(ctx: Pick<QueryCtx, "db">, source: Doc<"confirmedRows">) {
  const submission = await ctx.db.get(source.submissionId);
  return submission?.status === "accepted" && submission.acceptedRowIds?.includes(source.importRowId) === true;
}
export async function sources(ctx: Pick<QueryCtx, "db">, organizationId: Id<"organizations">, unitId: Id<"operationalUnits">, kind: Doc<"confirmedRows">["evidenceType"], distributorId?: Id<"distributors">) {
  const rows = await ctx.db.query("confirmedRows").withIndex("by_scope_type", (q) => q.eq("organizationId", organizationId).eq("operationalUnitId", unitId).eq("evidenceType", kind)).filter((q) => distributorId ? q.eq(q.field("distributorId"), distributorId) : q.eq(true, true)).take(5001);
  if (rows.length > 5000) return invalid("PILOT_SOURCE_LIMIT");
  const latest = new Map<string, Doc<"confirmedRows">>();
  for (const row of rows) { if (distributorId && row.distributorId !== distributorId) continue; if (!await activeSource(ctx, row)) continue; const previous = latest.get(row.fingerprint); if (!previous || row.revision > previous.revision) latest.set(row.fingerprint, row); }
  return [...latest.values()].map((record) => ({ record, data: JSON.parse(record.normalizedJson) as NormalizedRow }));
}
export async function activeReturnLines(ctx: Pick<QueryCtx, "db">, caseId: Id<"returnCases">) {
  const all = await ctx.db.query("returnLines").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect(); const latest = new Map<string, Doc<"returnLines">>();
  for (const line of all) { const source = await ctx.db.get(line.sourceRowId); if (!source || !await activeSource(ctx, source)) continue; const previous = latest.get(line.fingerprint); if (!previous || line._creationTime > previous._creationTime) latest.set(line.fingerprint, line); }
  return [...latest.values()];
}
export async function activeReceipts(ctx: Pick<QueryCtx, "db">, caseId: Id<"returnCases">) {
  const all = await ctx.db.query("receiptRecords").withIndex("by_case", (q) => q.eq("caseId", caseId)).collect(); const superseded = new Set(all.map((r) => r.supersedesId).filter(Boolean)); return all.filter((r) => !superseded.has(r._id));
}
export async function manufacturerSales(ctx: Pick<QueryCtx, "db">, organizationId: Id<"organizations">, unitId: Id<"operationalUnits">, distributorId: Id<"distributors">) {
  const all = await ctx.db.query("primarySales").withIndex("by_scope", (q) => q.eq("organizationId", organizationId).eq("operationalUnitId", unitId).eq("distributorId", distributorId)).take(5001); if (all.length > 5000) return invalid("PILOT_SOURCE_LIMIT");
  const rows = []; for (const row of all) { const source = await ctx.db.get(row.sourceRowId); if (!source || !await activeSource(ctx, source)) continue; rows.push({ record: row, data: { productId: row.productId, values: { quantity: row.quantity, unit_rate_inr: row.unitRateInr, invoice_number: row.invoiceNumber, invoice_date: row.invoiceDate, received_date: row.receivedDate, expiry_date: row.expiryDate, batch_number: row.batchNumber, tax_percent: row.taxPercent } } }); } return rows;
}
