import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { code, date, fingerprint, invalid } from "./contracts";
import { decimal, expectedStock, lineAmounts, quantity, rate, rupeesToPaise } from "./exact";
import { permitsUnit } from "./authorization";
import { jobAccess } from "./intakeAccess";
import { templateCatalog } from "./templateCatalog";

export type NormalizedRow = { operationalUnitId: Id<"operationalUnits">; distributorId: Id<"distributors">; productId: Id<"products">; values: Record<string, string>; amountPaise?: number };
export async function normalizeRow(ctx: MutationCtx, submission: Doc<"submissions">, values: Record<string, string>) {
  const actor = await jobAccess(ctx, submission);
  const template = submission.templateId ? await ctx.db.get(submission.templateId) : null;
  const catalog = templateCatalog[submission.evidenceType];
  const allowed: readonly string[] = ["template_version", ...catalog.required, ...catalog.optional];
  if (Object.keys(values).some((key) => !allowed.includes(key)) || catalog.required.some((key) => !values[key]) || values.template_version !== String(template?.version ?? 1)) return invalid("TEMPLATE_FIELDS_INVALID");
  if (Object.values(values).some((value) => value.length > 160 || /[\x00-\x08\x0b-\x1f]/.test(value) || /^[=+@]/.test(value))) return invalid("UNSAFE_CELL");
  const sameName = (left: string, right: string) => left.trim().toLocaleLowerCase("en-IN") === right.trim().toLocaleLowerCase("en-IN");
  const unit = await ctx.db.get(submission.operationalUnitId);
  if (!unit || !sameName(values.unit_name, unit.name)) return invalid("UNIT_NAME_MISMATCH");
  const distributor = (await ctx.db.query("distributors").withIndex("by_organization", (q) => q.eq("organizationId", submission.organizationId)).collect()).find((item) => sameName(values.distributor_name, item.name));
  if (!distributor?.active || !distributor.operationalUnitIds?.includes(unit._id) || !permitsUnit(actor.membership, unit._id) || (submission.distributorId && submission.distributorId !== distributor._id) || (actor.membership.role === "distributor" && distributor._id !== actor.membership.distributorId)) return invalid("UNKNOWN_DISTRIBUTOR");
  const product = (await ctx.db.query("products").withIndex("by_organization", (q) => q.eq("organizationId", submission.organizationId)).collect()).find((item) => sameName(values.product_name, item.name));
  if (!product?.active) return invalid("UNKNOWN_PRODUCT");
  if (!product.quantityUnit || values.quantity_unit !== product.quantityUnit) return invalid("QUANTITY_UNIT_MISMATCH");
  const normalized: Record<string, string> = { ...values, unit_name: unit.name, distributor_name: distributor.name, product_name: product.name };
  if (values.batch_number) normalized.batch_number = code(values.batch_number);
  if (values.expiry_date) { date(values.expiry_date); const batch = await ctx.db.query("batches").withIndex("by_product_batch", (q) => q.eq("organizationId", submission.organizationId).eq("productId", product._id).eq("batchNumber", normalized.batch_number)).unique(); if (batch && batch.expiryDate !== values.expiry_date) return invalid("BATCH_EXPIRY_MISMATCH"); }
  let amountPaise: number | undefined; const warnings: string[] = [];
  const key: Record<string, string> = { type: submission.evidenceType, unit: unit._id, distributor: distributor._id, product: product._id, batch: normalized.batch_number ?? "" };
  const periodStart = submission.periodStart; const periodEnd = submission.periodEnd;
  if (!periodStart || !periodEnd) return invalid("SUBMISSION_SCOPE_NOT_PREPARED");
  const inPeriod = (value: string) => { date(value); if (value < periodStart || value > periodEnd) return invalid("OUTSIDE_REPORT_PERIOD"); };
  switch (submission.evidenceType) {
    case "manufacturer_sales_shipments":
      date(values.invoice_date); inPeriod(values.received_date); if (values.received_date < values.invoice_date) return invalid("RECEIPT_BEFORE_SALE");
      normalized.quantity = quantity(values.quantity); if (decimal(normalized.quantity).isZero()) return invalid("POSITIVE_QUANTITY_REQUIRED");
      normalized.unit_rate_inr = quantity(values.unit_rate_inr); normalized.tax_percent = rate(values.tax_percent).toFixed(); amountPaise = rupeesToPaise(values.line_amount_inr); if (amountPaise < 0) return invalid("NEGATIVE_AMOUNT");
      if (!( ["half_up", "half_even", "down"] as const).some((rounding) => lineAmounts(normalized.quantity, normalized.unit_rate_inr, normalized.tax_percent, "0", rounding).totalPaise === amountPaise)) warnings.push("INVOICE_LINE_TOTAL_MISMATCH");
      key.invoice = code(values.invoice_number); key.shipment = code(values.shipment_reference); normalized.invoice_number = key.invoice; normalized.shipment_reference = key.shipment;
      break;
    case "distributor_return_claim":
      inPeriod(values.return_date); normalized.quantity = quantity(values.quantity); if (decimal(normalized.quantity).isZero()) return invalid("POSITIVE_QUANTITY_REQUIRED"); normalized.reason = code(values.reason); normalized.invoice_number = code(values.invoice_number); normalized.return_reference = code(values.return_reference); key.reference = normalized.return_reference; key.invoice = normalized.invoice_number;
      break;
    case "distributor_sales_stock": {
      if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(values.reporting_month) || values.reporting_month !== periodStart.slice(0, 7) || values.reporting_month !== periodEnd.slice(0, 7)) return invalid("PERIOD_MISMATCH"); date(periodStart); date(periodEnd);
      normalized.period_start = periodStart; normalized.period_end = periodEnd;
      for (const field of ["opening_stock", "receipts", "onward_sales", "distributor_returns", "transfers_in", "transfers_out", "damage", "reported_closing"]) normalized[field] = quantity(values[field]);
      normalized.customer_returns = "0";
      normalized.manufacturer_returns = normalized.distributor_returns;
      const expected = expectedStock({ opening: normalized.opening_stock, receipts: normalized.receipts, customerReturns: "0", transfersIn: normalized.transfers_in, onwardSales: normalized.onward_sales, manufacturerReturns: normalized.distributor_returns, damage: normalized.damage, transfersOut: normalized.transfers_out, approvedAdjustments: "0" });
      if (!decimal(expected, true).eq(decimal(normalized.reported_closing))) warnings.push("INTERNAL_STOCK_TOTAL_MISMATCH"); key.periodStart = periodStart; key.periodEnd = periodEnd;
      break;
    }
    case "issued_credit_notes":
      inPeriod(values.credit_date); normalized.quantity = quantity(values.quantity); amountPaise = rupeesToPaise(values.amount_inr); if (amountPaise < 0) return invalid("NEGATIVE_AMOUNT"); normalized.credit_note_number = code(values.credit_note_number); normalized.case_reference = code(values.case_reference); key.credit = normalized.credit_note_number; key.case = normalized.case_reference;
      break;
  }
  const row: NormalizedRow = { operationalUnitId: unit._id, distributorId: distributor._id, productId: product._id, values: normalized, ...(amountPaise === undefined ? {} : { amountPaise }) };
  return { row, fingerprint: fingerprint("source", key), warnings };
}
