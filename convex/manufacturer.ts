import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { jobAccess } from "./lib/intakeAccess";
import { activeSource } from "./lib/businessSources";
import { paise, quantity, rate } from "./lib/exact";
import type { NormalizedRow } from "./lib/normalizeRow";

export const projectSubmission = internalMutation({
  args: { submissionId: v.id("submissions"), actorUserId: v.id("users"), cursor: v.number() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || s.evidenceType !== "manufacturer_sales_shipments") return { done: true, cursor: args.cursor };
    await jobAccess(ctx, { ...s, submittedBy: args.actorUserId }); const rows = await ctx.db.query("confirmedRows").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect();
    for (const row of rows.slice(args.cursor, args.cursor + 30)) { if (!await activeSource(ctx, row) || await ctx.db.query("primarySales").withIndex("by_source", (q) => q.eq("sourceRowId", row._id)).unique()) continue; const d = JSON.parse(row.normalizedJson) as NormalizedRow; const value = d.values; await ctx.db.insert("primarySales", { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: d.distributorId, productId: d.productId, sourceRowId: row._id, invoiceNumber: value.invoice_number, invoiceDate: value.invoice_date, shipmentReference: value.shipment_reference, receivedDate: value.received_date, batchNumber: value.batch_number, expiryDate: value.expiry_date, quantity: quantity(value.quantity), quantityUnit: value.quantity_unit, unitRateInr: quantity(value.unit_rate_inr), taxPercent: rate(value.tax_percent).toFixed(), lineAmountPaise: paise(d.amountPaise!), createdAt: Date.now() }); }
    const cursor = args.cursor + 30; return { done: cursor >= rows.length, cursor };
  },
});
