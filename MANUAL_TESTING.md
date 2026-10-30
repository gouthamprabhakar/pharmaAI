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
