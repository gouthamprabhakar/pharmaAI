export const templateCatalog = {
  manufacturer_sales_shipments: { required: ["unit_code", "distributor_code", "invoice_number", "invoice_date", "shipment_reference", "received_date", "product_code", "batch_number", "expiry_date", "quantity", "quantity_unit", "unit_rate_inr", "tax_percent", "line_amount_inr"], optional: [] },
  distributor_return_claim: { required: ["unit_code", "distributor_code", "return_reference", "return_date", "invoice_number", "product_code", "batch_number", "expiry_date", "quantity", "quantity_unit", "reason"], optional: [] },
  distributor_sales_stock: { required: ["unit_code", "distributor_code", "period_start", "period_end", "product_code", "quantity_unit", "opening_stock", "receipts", "onward_sales", "customer_returns", "manufacturer_returns", "transfers_in", "transfers_out", "damage", "reported_closing"], optional: ["batch_number"] },
  issued_credit_notes: { required: ["unit_code", "distributor_code", "credit_note_number", "credit_date", "case_reference", "product_code", "quantity", "quantity_unit", "amount_inr"], optional: ["batch_number"] },
} as const;
