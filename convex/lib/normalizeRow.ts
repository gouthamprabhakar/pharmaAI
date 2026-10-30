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
  if (!template) return invalid("TEMPLATE_REQUIRED");
  const catalog = templateCatalog[submission.evidenceType];
  const allowed: readonly string[] = ["template_version", ...catalog.required, ...catalog.optional];
  if (Object.keys(values).some((key) => !allowed.includes(key)) || catalog.required.some((key) => !values[key]) || values.template_version !== String(template.version)) return invalid("TEMPLATE_FIELDS_INVALID");
  if (Object.values(values).some((value) => value.length > 160 || /[\x00-\x08\x0b-\x1f]/.test(value) || /^[=+@]/.test(value))) return invalid("UNSAFE_CELL");
  const unit = await ctx.db.get(submission.operationalUnitId);
  if (!unit || code(values.unit_code) !== unit.code) return invalid("UNIT_CODE_MISMATCH");
  const distributor = await ctx.db.query("distributors").withIndex("by_organization_and_code", (q) => q.eq("organizationId", submission.organizationId).eq("code", code(values.distributor_code))).unique();
  if (!distributor?.active || !distributor.operationalUnitIds?.includes(unit._id) || !permitsUnit(actor.membership, unit._id) || (submission.distributorId && submission.distributorId !== distributor._id) || (actor.membership.role === "distributor" && distributor._id !== actor.membership.distributorId)) return invalid("UNKNOWN_DISTRIBUTOR");
  let product = await ctx.db.query("products").withIndex("by_organization_and_code", (q) => q.eq("organizationId", submission.organizationId).eq("code", code(values.product_code))).unique();
  if (!product) { const alias = await ctx.db.query("productAliases").withIndex("by_alias", (q) => q.eq("organizationId", submission.organizationId).eq("distributorId", distributor._id).eq("alias", code(values.product_code))).unique(); if (alias) product = await ctx.db.get(alias.productId); }
  if (!product?.active) return invalid("UNKNOWN_PRODUCT");
  if (!product.quantityUnit || values.quantity_unit !== product.quantityUnit) return invalid("QUANTITY_UNIT_MISMATCH");
  const normalized: Record<string, string> = { ...values, unit_code: unit.code, distributor_code: distributor.code, product_code: product.code };
  if (values.batch_number) normalized.batch_number = code(values.batch_number);
  if (values.expiry_date) { date(values.expiry_date); const batch = await ctx.db.query("batches").withIndex("by_product_batch", (q) => q.eq("organizationId", submission.organizationId).eq("productId", product._id).eq("batchNumber", normalized.batch_number)).unique(); if (batch && batch.expiryDate !== values.expiry_date) return invalid("BATCH_EXPIRY_MISMATCH"); }
  let amountPaise: number | undefined; const warnings: string[] = [];
  const key: Record<string, string> = { type: submission.evidenceType, unit: unit._id, distributor: distributor._id, product: product._id, batch: normalized.batch_number ?? "" };
  const inPeriod = (value: string) => { date(value); if (value < submission.periodStart || value > submission.periodEnd) return invalid("OUTSIDE_REPORT_PERIOD"); };
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
      if (values.period_start !== submission.periodStart || values.period_end !== submission.periodEnd) return invalid("PERIOD_MISMATCH"); date(values.period_start); date(values.period_end);
      for (const field of ["opening_stock", "receipts", "onward_sales", "customer_returns", "manufacturer_returns", "transfers_in", "transfers_out", "damage", "reported_closing"]) normalized[field] = quantity(values[field]);
      const expected = expectedStock({ opening: normalized.opening_stock, receipts: normalized.receipts, customerReturns: normalized.customer_returns, transfersIn: normalized.transfers_in, onwardSales: normalized.onward_sales, manufacturerReturns: normalized.manufacturer_returns, damage: normalized.damage, transfersOut: normalized.transfers_out, approvedAdjustments: "0" });
      if (!decimal(expected, true).eq(decimal(normalized.reported_closing))) warnings.push("INTERNAL_STOCK_TOTAL_MISMATCH"); key.periodStart = values.period_start; key.periodEnd = values.period_end;
      break;
    }
    case "issued_credit_notes":
      inPeriod(values.credit_date); normalized.quantity = quantity(values.quantity); amountPaise = rupeesToPaise(values.amount_inr); if (amountPaise < 0) return invalid("NEGATIVE_AMOUNT"); normalized.credit_note_number = code(values.credit_note_number); normalized.case_reference = code(values.case_reference); key.credit = normalized.credit_note_number; key.case = normalized.case_reference;
      break;
  }
  const row: NormalizedRow = { operationalUnitId: unit._id, distributorId: distributor._id, productId: product._id, values: normalized, ...(amountPaise === undefined ? {} : { amountPaise }) };
  return { row, fingerprint: fingerprint("source", key), warnings };
}
