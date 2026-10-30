# Manual acceptance checklist

The user requested implementation first and manual acceptance. Unchecked cases are not verified. Use fictional data in the development workspace. Real client use remains blocked by the security/provider gates in `todo.md`.

## Access and setup

- [ ] Sign in with the permitted Google account, select its existing workspace if asked, sign out, and sign in again.
- [ ] Open Administration > Organization & operational units. Save manufacturer name/time zone, create a depot, assign its workflows, then reload and verify persistence.
- [ ] Add products with stable codes and an explicit quantity unit; add distributors linked only to their permitted depots.
- [ ] Add product aliases and batch/expiry records. Try a duplicate code, conflicting alias, invalid date and cross-unit grant; each must be rejected.
- [ ] Publish each controlled template with an effective date. Set a manufacturer-approved return policy, explicit tax/deduction/rounding and credit deadline; set stock quantity/value tolerances.
- [ ] Set monthly distributor reporting obligations using the Sales & Stock template and deadline time zone.
- [ ] Open `/setup`, change steps, reload, and confirm the saved step and configuration remain.
- [ ] Open Team & access. Review each role and unit grant. Verify a distributor cannot read internal configuration, another distributor's files or Finance actions.

## Data Intake

- [ ] Choose the unit and download its published Excel/CSV template. The Data sheet must contain controlled headers and clear version instructions.
- [ ] Fill fictional manufacturer shipment records using configured codes. Upload with matching period/version; follow real job states.
- [ ] Without a configured scanner, expect **blocked/quarantined**, never “scan passed” or “accepted”. Configure an approved scanning/DLP service before continuing file acceptance.
- [ ] With a configured scanner, try invalid headers, formulas, unknown codes, missing required fields, invalid decimals, duplicates and wrong periods. Expect actionable record errors; no false success.
- [ ] Correct or exclude a failed record with a reason. Verify its old revision remains and the new revision is validated.
- [ ] Review a stock-total warning, explicitly accept it for reconciliation, and confirm usable records. Verify **accepted** appears only after durable confirmation finishes.
- [ ] Repeat the same upload/confirmation and interrupt navigation while processing. Verify history recovers the same submission/job without duplicate normalized records.
- [ ] Upload a corrected file as a correction of an accepted submission. The original remains available; the prior accepted version is replaced only after successful confirmation.
- [ ] Download original evidence while authorized, then remove the user's scope and retry its saved download link. It must deny access.

Returns, credits, stock, queue, reports and AI acceptance steps will be added as their connected slices are implemented. This checklist does not certify those workflows yet.

## Returns and Credits

- [ ] Confirm a return claim after manufacturer sales are accepted. Repeating confirmation/linking must keep one stable case and preserve old evidence versions.
- [ ] Open the case. Check original invoice, submitted quantities, manufacturer receipt and separate quantity/amount columns. Missing evidence must remain unknown.
- [ ] Record a physically verified receipt and optional photos. Unscanned photos must remain inaccessible. Correct a receipt with a reason; verify the original history remains.
- [ ] Select the effective manufacturer policy, calculate eligibility and verify rates, taxes, deductions, window and quantity caps. Try missing/ambiguous invoices and excess quantities; approval must not bypass them.
- [ ] Approve, reject or request clarification with a reason. Change evidence after calculation; stale approval must be rejected until recalculated.
- [ ] Open Awaiting credit. Record an actually-issued note or import credit rows and confirm the full note total. Approval alone must never count as issued credit.
- [ ] Try exact, partial, excess and ambiguous allocations, corrected allocations and zero-value approvals. Check outstanding balance, quantity comparison, closure and audit history.

## Distributor Sales and Stock

- [ ] Accept a manufacturer shipment file covering the period and an independent distributor monthly report. Verify stable report/variance identity on retry and corrected submission.
- [ ] Confirm the first opening balance with an evidence reference; never treat an unverified declaration as a verified opening. A contiguous reconciled prior closing must take precedence in later periods.
- [ ] Check all movements in the equation, independent receipts, missing batch precision and exact quantity variance. No negative expected stock or missing source should be silently confirmed.
- [ ] Publish effective quantity/value tolerances. Verify exact matching and nonzero differences. Leave financial exposure unknown until a reviewer confirms an evidenced rate and rounding.
- [ ] Recalculate after correcting source evidence. Request correction, approve an evidenced adjustment, supersede an incorrect adjustment, escalate, carry forward and resolve with a reason. Original reports/runs must remain unchanged.
- [ ] Check reporting obligations, due dates and time zones; missing, partial and late reports differ from accepted reports. An administrator waiver must retain a reason.

## Shared queue, reporting and AI

- [ ] Trigger return eligibility, partial/excess/overdue credit, stock and missing-report exceptions. Verify stable queue identity, team routing and recurrence when source evidence changes.
- [ ] Assign a permitted team member, set a due date and priority, add internal comments and attach an existing protected evidence link. Distributor accounts must not access internal discussions or queue records.
- [ ] Resolve or reopen a task with evidence and a reason. Its return approval, issued credit and stock decisions must remain separate.
- [ ] Change global unit/distributor/period filters. Cards, reports, queue and briefs must stay in the same authorized scope. Local search/status filters only their table.
- [ ] Trace report totals to individual case/variance records. Unknown valuation must be excluded explicitly rather than shown as a known zero. Export with a granted role; denied roles and removed scope must fail.
- [ ] Open Administration > Audit history and Notifications & routing. Check new append-only events, assignment/overdue notifications and read/preferences persistence. No external email is sent by the reminder job.
- [ ] Without an AI model/key or enabled budget, expect a clear unavailable state and working manual controls. Never expect generated success text.
- [ ] After authorized provider configuration, enable conservative request/reservation limits. Generate a cited case/stock/management brief. Check every citation and uncertainty label against the stored calculation.
- [ ] Upload a checked image/PDF, request extraction, correct visible fields and confirm them. This must save a separate evidence version; it must not create a physical receipt or approve/credit anything.
- [ ] Repeat unchanged AI input. It should reuse a saved/uncertain request, not create another provider call. Test invalid citations, refusal, timeout, exhausted limits and permission loss; manual work must remain possible.

## Final supporting controls

- [ ] From a return case, use Assign review with a permitted reviewer and due date; verify the same task appears in the Returns team queue and an in-app notification is available.
- [ ] In a case/variance Activity tab, open historical calculation evidence and download retained sources. Looking at an old run must not change the current decision or calculation.
- [ ] Correct a return date through an explicitly replaced accepted claim. It may change only when no active conflicting claim remains. Previously recorded credit quantities must remain traceable through the logical line identity.
- [ ] Select a human-reviewed extraction in the receipt form. Only one unambiguous product/batch may prefill; physically verify the quantities and save a reason separately.
- [ ] Review Administration > Security & privacy service/job status. Treat unavailable providers, stale checks and blocked jobs as outstanding work, never as passed operations.
