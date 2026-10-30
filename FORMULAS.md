# PharmaAI formulas and identifiers

This file explains the MVP calculations and record identifiers in plain language. The deterministic implementation remains authoritative. AI may explain these results, but it does not change the calculations or approve a business action.

## 1. Manufacturer shipment records

### What one row represents

One row represents one product and batch shipped by the manufacturer to one distributor.

### Demo line identifier

```text
Depot + Distributor + Invoice number + Shipment reference + Product name + Batch number
```

- **Invoice number** identifies the manufacturer sale or billing document.
- **Shipment reference** identifies the physical dispatch or delivery.
- **Product name** is used in the development demo. Production should use a stable product code and display the product name beside it.
- **Batch number** identifies the product's manufacturing batch.
- One invoice may contain several product or batch lines, so the invoice number alone does not identify a line.

## 2. Distributor sales and stock records

### What one row represents

One row is an aggregate for one distributor, product and batch during one reporting month. It is not an individual sale to a retailer. One upload contains one distributor, one depot and one month, with multiple product and batch rows.

### Report-line identifier

```text
Depot + Distributor + Reporting month + Product + Batch number
```

If invoice-level retailer sales are required later, they need a separate transaction file containing the distributor's own invoice or sale reference.

### Stock available after receipts

```text
Stock available = Opening stock + Verified manufacturer receipts + Transfers in
```

### Expected closing stock

```text
Expected closing stock
  = Opening stock
  + Verified manufacturer receipts
  + Transfers in
  - Onward sales
  - Distributor returns
  - Transfers out
  - Damage
  + Approved adjustments
```

- **Opening stock** is the distributor's stock before the reporting-period receipts are added.
- **Verified manufacturer receipts** come from the accepted manufacturer shipment evidence. The distributor's declared receipts are compared with that evidence.
- **Onward sales** are the distributor's aggregate sales to retailers or other downstream customers.
- **Distributor returns** are packs the distributor sends back to the manufacturer.
- **Transfers in/out** are movements between the distributor's own locations.
- **Reported closing stock** is what the distributor reports at the end of the period.
- Customer returns are not part of the approved upload template. The MVP treats them as zero.

### Quantity variance

```text
Quantity variance = Reported closing stock - Expected closing stock
```

- Zero means the report balances exactly.
- A negative value means the distributor reported less stock than expected.
- A positive value means the distributor reported more stock than expected.
- A variance is an exception to investigate. It is not proof of wrongdoing.

### Dolo-650 example

```text
Opening stock                 120 packs
Manufacturer receipts       +100 packs
Onward sales                 -70 packs
Distributor returns            0 packs
Transfers in/out               0 packs
Damage                         0 packs
Expected closing stock       150 packs
Reported closing stock       150 packs
Quantity variance              0 packs
```

The opening-stock cell stays at 120. PharmaAI calculates the 220 packs available after receipt; the distributor does not replace opening stock with 220.

### First reporting month

The first monthly distributor report has no earlier confirmed closing stock to use as its opening baseline. An authorized manufacturer reviewer therefore confirms the complete report once with **Confirm report — looks good**. That action records each product-and-batch opening quantity as the first-month baseline; it does not approve a return, issue a credit, or change inventory.

After the first month, the previous confirmed closing quantity becomes the next month's opening baseline automatically. An exact zero variance is a match and does not require a tolerance rule. A non-zero difference requires an effective tolerance rule or human review.

## 3. Return eligibility

For each return line, PharmaAI matches the original manufacturer sale by distributor, invoice, product and batch. Deterministic rules then check the applicable policy, expiry window, permitted reason, remaining sold quantity and any required receipt evidence.

```text
Remaining sold quantity = Quantity originally sold - Quantity already approved for return
```

```text
Eligible return quantity
  = the lowest permitted quantity after applying:
    submitted quantity,
    remaining sold quantity,
    and confirmed received quantity when the policy requires a receipt
```

If the original sale, applicable policy or required receipt is missing, the line is not automatically eligible. A person makes the consequential approval or rejection decision.

## 4. Return and credit amounts

All money is stored as integer paise. The effective policy supplies tax, deduction and rounding rules.

```text
Gross amount = Eligible quantity × Unit rate
Deduction = Gross amount × Deduction percentage
Net before tax = Gross amount - Deduction
Tax = Net before tax × Tax percentage
Expected credit = Net before tax + Tax
```

Each component is rounded to paise using the rounding method recorded in the applicable policy version.

### Credit matching

```text
Credit difference = Expected credit - Confirmed issued credit
Outstanding credit = maximum of Credit difference and zero
Excess credit = maximum of negative Credit difference and zero
```

- **Exact** means confirmed issued credit equals the approved expected credit and the quantities match.
- **Partial** means some credit was issued but an amount remains outstanding.
- **Excess** means confirmed issued credit exceeds the expected amount or the quantities do not match.
- **Awaiting credit** means an approved return has no confirmed issued credit yet.

## 5. Upload confirmation versus business approval

Confirming an upload means the validated rows become usable evidence and appear in Submission History. It does not approve a return, issue a credit, change inventory or resolve an exception.

## 6. Precision and authority

- Quantities and rates use exact decimal arithmetic, not floating point.
- INR is stored as integer paise.
- Rerunning the same evidence updates or reopens the same discrepancy by its stable fingerprint; it does not create a duplicate.
- Saved rule versions, source evidence, calculation snapshots and audit events remain attached to the result.
