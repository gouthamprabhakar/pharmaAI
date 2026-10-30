# PharmaAI Web MVP Product Specification

Status: approved product specification
Product: PharmaAI
Platform: responsive web application
Repository: existing `pharmaAI` repository
Date: 29 October 2026

## 1. Purpose

PharmaAI helps pharmaceutical manufacturers reconcile two independent business controls:

1. **Returns and Credits:** verify that a distributor return is supported by an original manufacturer sale, complies with the applicable return policy, receives a human approval decision, and is followed by the correct manufacturer-issued credit.
2. **Sales and Stock:** compare a distributor's expected closing inventory with the closing inventory the distributor reports, then investigate unexplained differences.

PharmaAI is an evidence and exception-management layer. It does not replace the manufacturer's ERP, distributor-management system, finance system, or human approval process.

The primary value proposition is:

> Bring manufacturer and distributor evidence together, calculate what should reconcile, use AI to explain ambiguity and exceptions, and route human decisions through one auditable workflow.

## 2. Target customer and users

### Target customer

The initial customer profile is an Indian pharmaceutical manufacturer operating through multiple divisions, regions, depots, C&F agents, and distributors. Micro Labs may be a discovery or pilot prospect, but it is not hard-coded and must not be presented as a customer without authorization.

### User roles

| Role | Primary responsibility |
|---|---|
| Owner | Organization ownership, security, final administrative access |
| Administrator | Units, products, distributors, templates, policies, deadlines, users |
| Returns Reviewer | Eligibility review, clarification, approval, rejection |
| Finance User | Credit issuance, credit matching, credit exceptions |
| Sales/Inventory Reviewer | Distributor reporting and stock-variance investigation |
| Executive/Viewer | Read-only dashboards, reports, and evidence-backed questions |
| Distributor User | Restricted submission of that distributor's returns and monthly reports |

Distributor users cannot access other distributors, internal policies beyond necessary submission guidance, internal comments, manufacturer-wide finance data, or company-wide reports.

## 3. MVP scope

### Included

- Responsive browser application.
- Manufacturer and restricted distributor access.
- Standard, versioned import templates.
- Manufacturer invoice and shipment intake.
- Distributor return submission.
- Manufacturer/C&F goods-receipt evidence and photographs.
- AI-assisted image and document extraction.
- Rules-based return eligibility and expected-credit calculation.
- Human return approval.
- Individual credit recording and standardized bulk credit import.
- Credit matching and closure.
- Mandatory monthly distributor sales-and-stock reporting.
- Rules-based expected-stock calculation.
- AI-assisted discrepancy explanation and prioritization.
- Shared Review Queue.
- Management overview, reports, notifications, and audit history.
- Roles, permissions, processing recovery, and usage controls.

### Excluded from v1

- Native iOS or Android applications.
- Expo, React Native, NativeWind, EAS, or app-store delivery.
- Replacement of an ERP, DMS, accounting system, or finance system.
- Autonomous return approvals, credit issuance, inventory changes, or exception closure.
- Deep ERP or distributor-system integrations.
- Advanced demand forecasting or stock redistribution.
- Patient-identifiable information.
- Self-service billing and complex subscription management.
- Complex configurable approval chains.
- Formal compliance-certification claims.

## 4. Product principles

1. Deterministic calculations, validations, permissions, and policy rules are authoritative.
2. AI assists with unstructured evidence and ambiguity; it is not financial truth.
3. Human users approve consequential return, credit, and inventory decisions.
4. Original evidence and historical calculations remain reproducible.
5. Every important result links to its supporting records.
6. Normal work should be short. Temporary processing states are not primary destinations.
7. The manufacturer may require distributors to use standard templates and deadlines.
8. A variance is an investigation signal, never automatic evidence of wrongdoing.
9. The application must clearly distinguish fictional demonstration behavior from connected production behavior.

## 5. Returns and Credits workflow

1. The manufacturer configures products, distributors, return policies, templates, tolerances, and credit deadlines.
2. A restricted distributor user submits a return request using the standard template. A manufacturer administrator may upload on the distributor's behalf.
3. The manufacturer or C&F operator records what physically arrived and photographs returned packs. Distributor pre-dispatch images are optional supporting evidence.
4. AI reads images and documents, extracts product, batch, expiry, quantity, invoice, and return references, and suggests likely record matches.
5. A person confirms or corrects uncertain fields. Confirmed corrections become reusable mappings where safe.
6. Deterministic rules verify the original sale, product, batch, quantity, policy eligibility, deductions, and expected credit.
7. A Returns Reviewer sees the evidence, policy version, calculation, AI explanation, and uncertainty before approving, rejecting, or requesting clarification.
8. Approved cases enter an `Awaiting Credit` finance worklist.
9. Finance records a credit note on a case or imports a standardized bulk credit file. A future ERP integration may automate this step.
10. PharmaAI compares expected and issued credit:
    - Exact match: confirm and close.
    - Short credit: partially credited and assigned to Finance.
    - Excess or unmatched credit: review required.
    - Missing credit after the deadline: overdue.

### Return-case evidence order

1. Original manufacturer sales invoice.
2. Distributor return request.
3. Manufacturer/C&F receipt record and photographs.
4. Eligibility calculation and applicable policy version.
5. Human approval decision.
6. Manufacturer-issued credit note.

## 6. Sales and Stock workflow

1. The manufacturer assigns a standard monthly reporting template and deadline to each distributor.
2. The manufacturer provides independent shipment or primary-sales evidence.
3. The distributor reports opening stock, receipts, onward sales, customer returns, manufacturer returns, transfers, damage, adjustments, and closing stock.
4. PharmaAI validates the template, required values, dates, codes, duplicates, internal consistency, and reporting period.
5. Deterministic software calculates:

   `Expected closing stock = opening stock + manufacturer receipts + customer returns + transfers in - onward sales - returns to manufacturer - damage - transfers out +/- approved adjustments`

6. Expected closing stock is compared with distributor-reported closing stock.
7. Exact or tolerated differences are confirmed. Missing data becomes incomplete. Late reports become overdue. Unexplained differences become variances.
8. AI cites the relevant records and suggests likely causes such as timing, duplication, product-code mismatch, unrecorded transfer, or recurring reporting patterns.
9. A Sales/Inventory Reviewer requests corrected data, accepts an evidenced timing difference, records an approved adjustment, escalates the issue, or carries it forward.
10. Reports show quantity and financial exposure by distributor, product, region, period, age, and responsible team.

## 7. Source-of-truth matrix

| Information | Authoritative source |
|---|---|
| Organization, membership, and access | Manufacturer administrator through Clerk/PharmaAI |
| Products and product codes | Manufacturer product master |
| Distributors and operational units | Manufacturer configuration |
| Sales invoices and shipments | Manufacturer ERP/export |
| Return request | Distributor submission |
| Goods physically received | Manufacturer/C&F receipt record |
| Return policy | Manufacturer's versioned policy |
| Eligibility and expected credit | Deterministic PharmaAI calculation |
| Approval decision | Authorized manufacturer reviewer |
| Issued credit note | Manufacturer finance system or authorized finance user |
| Onward sales and reported stock | Distributor's mandatory monthly report |
| Expected distributor stock | Deterministic PharmaAI calculation |
| AI extraction, explanation, and priority | Advisory output with evidence and confidence |

## 8. AI product role

### MVP capabilities

- Extract product, batch, expiry, quantity, invoice, return, and credit information from photographs, PDFs, and spreadsheets.
- Suggest product, distributor, invoice, batch, return, and credit matches when identifiers differ.
- Explain what matched, what did not, which policy applied, and why attention is required.
- Cite the supporting source record for every material explanation.
- Summarize cases for reviewers.
- Rank exceptions using financial exposure, age, recurrence, evidence quality, and deadlines.
- Answer management questions over reconciled data with evidence links.

### Confidence and correction

- Exact deterministic matches are attempted before AI.
- Uncertain extraction and matching are visibly highlighted.
- A user confirms or corrects uncertain values.
- Original evidence, AI output, confidence, model version, prompt version, and correction remain auditable.

### Prohibited AI actions

AI cannot approve or reject a return, produce authoritative financial calculations, issue a credit note, change inventory, resolve an exception, modify a policy, change permissions, or present an unsupported answer as fact.

### AI failure and cost control

- Structured imports and deterministic reconciliation continue when AI is unavailable.
- Manual correction is always available.
- Saved mappings and exact matching run before AI calls.
- Unchanged evidence is not repeatedly analyzed.
- Organization usage and estimated cost are monitored and limited.
- Exhausted limits route work to manual review instead of blocking essential workflows.

## 9. Application structure

### Primary work areas

1. Overview.
2. Returns & Credits.
3. Sales & Stock.
4. Review Queue.

### Supporting areas

5. Data Intake.
6. Reports.
7. Administration.

### Required views

1. Landing page.
2. Sign in and invitation.
3. Guided setup.
4. Overview.
5. Data Intake.
6. Returns & Credits.
7. Return Case Workspace.
8. Sales & Stock.
9. Variance Workspace.
10. Review Queue with integrated detail.
11. Reports.
12. Administration.

Temporary processing, mapping, validation, extraction, notification, run-history, and adjustment states appear within these views rather than as competing primary destinations.

## 10. Required view contents

### Landing

Explain both modules, the evidence-led AI role, human control, and fictional demonstration status. Offer Sign In and Request Demo.

### Sign in and invitation

Use Clerk Google authentication only for the pilot. Add other sign-in or account-creation methods only after approval. Support verified invitations, organization context, role, and permitted scope.

### Guided setup

Configure organization, units, products, distributors, policies, templates, deadlines, team, and optional fictional sample data in one resumable wizard.

### Overview

Show fixed manufacturer context, permitted filters, returns, credits, sales/stock variances, reporting compliance, Review Queue priorities, and an evidence-linked AI management summary. Every total drills into its records.

### Data Intake

Support manufacturer sales/shipments, distributor returns, receipt evidence, credit notes, and distributor monthly reports. Include template downloads, validation, correction, processing progress, evidence history, and exceptional legacy mappings.

### Returns & Credits

Show return cases by eligibility, clarification, credit, overdue, exception, and closed status. Include assignment, due dates, finance worklist, credit history, search, filters, and appropriate bulk actions.

### Return Case Workspace

Show separate internal and distributor references, chronological evidence, submitted/received/eligible/approved quantities, amounts, policy version, AI explanation, citations, confidence, correction, approval controls, finance action, comments, ownership, deadlines, and audit history.

### Sales & Stock

Show reporting compliance, expected and reported closing stock, quantity and financial variance, status, and views by distributor, product, batch, region, and period.

### Variance Workspace

Show the full calculation, source records, AI explanation and confidence, recurrence history, correction request, evidenced adjustment, escalation, reason, ownership, and audit history.

### Review Queue

Combine Return, Finance, Sales, Inventory, and Data exceptions. Route by team and owner. Show priority, exposure, age, due date, evidence quality, AI recommendation, detail, resolution, and reopening history.

### Reports

Provide Executive, Returns & Credits, Sales & Stock, Reporting Compliance, and Review Queue views. Support scoped export and evidence-linked management questions.

### Administration

Contain organization, units, products, aliases, distributors, templates, policies, tolerances, deadlines, team, permissions, security, AI usage, and audit history.

## 11. Status models

### Return case

`Submitted -> Evidence processing -> Awaiting eligibility review -> Clarification requested / Rejected / Approved - awaiting credit -> Partially credited / Credit overdue / Confirmed and closed`

### Distributor report

`Draft -> Submitted -> Validating -> Correction required / Accepted -> Replaced by corrected report`

Independent compliance states include `On time`, `Overdue`, `Non-compliant`, and `Waived with reason`.

### Sales variance

`Calculated -> Within tolerance / Investigation required -> Awaiting distributor correction / Awaiting internal action -> Resolved / Carried forward`

### Review item

`Open -> Assigned -> In review -> Awaiting external response -> Resolved -> Reopened`

Workflow status and resolution outcome remain separate.

## 12. Validation and background work

### Validation

Check template/version, required fields, dates, numbers, codes, duplicates, period consistency, product/batch relationships, internal totals, stock equations, file type/size/security, and prohibited patient-identifiable information.

Validation decides whether data is usable. Reconciliation decides whether independent business records agree.

### Background work

File scanning, parsing, extraction, matching, reconciliation, explanation, and exports run as resumable jobs. Users see the real processing step and counts where known. Retries are idempotent and cannot duplicate records, cases, credits, notifications, calculations, or AI charges.

### Failure behavior

- AI failure falls back to manual work.
- Invalid rows are isolated without discarding valid rows.
- Original evidence is retained.
- Failed reruns never replace the latest valid reconciliation.
- Network loss never produces false success.
- Permission loss immediately blocks access.
- Errors provide a safe recovery action.
- Empty states identify the next required input.

## 13. Security, privacy, and audit

- Clerk manages identity, sign-in, invitations, organization context, and re-verification.
- Convex enforces tenant, role, unit, and distributor scope for every protected operation.
- UI visibility is never authorization.
- Owner and Administrator MFA is required.
- Sensitive exports and access changes require re-verification.
- Evidence files use authorization-gated access.
- Patient-identifiable information is prohibited in data, files, logs, analytics, and AI prompts.
- Secrets stay in protected environment configuration.
- Audit records are append-only.
- AI receives the minimum evidence needed for the task.

## 14. Web, accessibility, and performance

- Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.
- Clerk for authentication and user management.
- Convex for operational data and background workflow state.
- Desktop is the primary work surface; tablet and mobile browsers remain fully usable.
- Current Chrome, Edge, Safari, and Firefox are supported.
- Keyboard navigation, semantic HTML, visible focus, accessible names, and sufficient contrast are required.
- Financial amounts and quantities remain readable without page-level horizontal overflow.
- Large datasets use pagination or virtualization.
- Background jobs survive navigation and expose resumable state.
- Dashboards read stored reconciliation results rather than recalculating entire periods on page load.

## 15. Environments, monitoring, and testing

### Environments

- Local development.
- Staging with fictional or approved de-identified data.
- Production with separate Clerk, Convex, hosting, secrets, and monitoring configuration.

### Monitoring

Track authentication and permission failures, import/reconciliation outcomes, background-job failures, AI latency/failure/usage/cost, overdue reports, high-value unresolved exceptions, slow requests, application errors, and consequential audit events. Sensitive evidence never enters ordinary logs.

### Testing

- Unit tests for monetary and inventory calculations.
- Role and scope authorization tests.
- Import validation and duplicate-prevention tests.
- AI structured-output and fallback tests.
- End-to-end Returns and Sales workflows.
- Responsive browser and accessibility checks.
- Demo/production-behavior separation tests.
- Lint, typecheck, test, and production build before handoff.

## 16. Existing design traceability

| Existing design | Decision | MVP destination |
|---|---|---|
| `landing-page.png` | Keep and revise | Landing |
| `auth-sign-in-code-expired.png` | Keep and revise | Sign in |
| `auth-workspace-invitation.png` | Merge | Sign in/invitation state |
| `onboarding-organization.png` | Merge | Guided setup |
| `onboarding-operational-unit.png` | Merge | Guided setup |
| `onboarding-channel-partner.png` | Merge | Guided setup |
| `onboarding-sample-data.png` | Merge | Guided setup |
| `overview-dashboard.png` | Keep and revise | Overview |
| `imports-list.png` | Keep and revise | Data Intake history |
| `import-new.png` | Keep and revise | Data Intake upload flow |
| `import-processing.png` | Remove as destination | In-flow progress state |
| `import-column-mapping.png` | Move | Initial setup/exception dialog |
| `import-validation-results.png` | Merge | Data Intake validation step |
| `document-extraction-review.png` | Merge | Return/variance evidence confirmation |
| `returns-reconciliation.png` | Keep and revise | Returns & Credits |
| `return-case-detail.png` | Keep and substantially revise | Return Case Workspace |
| `manufacturer-credit-notes.png` | Merge | Awaiting Credit/Credit History inside Returns & Credits |
| `returns-runs.png` | Move | Administration > Audit History |
| `sales-reconciliation.png` | Keep and revise | Sales & Stock |
| `inventory-variance-detail.png` | Keep and substantially revise | Variance Workspace |
| `distributor-inventory.png` | Merge | Sales & Stock inventory view |
| `inventory-adjustment-new.png` | Merge | Variance Workspace action |
| `sales-runs.png` | Move | Administration > Audit History |
| `review-queue.png` | Keep and revise | Review Queue |
| `review-item-detail.png` | Merge | Review Queue integrated detail |
| `reports.png` | Keep and revise | Reports |
| `notifications.png` | Remove as destination | Header notification panel/preferences |
| `team-access.png` | Move | Administration > Team & Access |
| `audit-history.png` | Move | Administration > Audit History |
| `settings-overview.png` | Keep and revise | Administration |
| `settings-operational-units.png` | Merge | Administration > Units |
| `settings-distributors-stockists.png` | Merge | Administration > Distributors |
| `settings-reconciliation-rules.png` | Merge | Administration > Policies & Rules |
| `settings-security.png` | Merge | Administration > Security |
| `system-edge-states.png` | Remove as destination | Reusable loading/empty/error/permission patterns |

No obsolete page remains visible merely for possible future use. Old references remain recoverable through Git until the revised application and design set are verified.

## 17. Definition of done

The MVP is complete only when a fictional manufacturer can:

1. Configure the organization, products, distributors, templates, policies, deadlines, and team.
2. Invite internal and restricted distributor users.
3. Complete a return from submission through receipt, eligibility, approval, credit, and closure.
4. Complete a monthly distributor report through validation, expected-stock calculation, variance investigation, and resolution.
5. See AI extraction, matching, explanation, prioritization, confidence, correction, and citations.
6. Route exceptions through the shared Review Queue.
7. View scoped management reports and audit history.
8. Use all essential functions across supported browser widths and keyboard navigation.
9. Recover safely from invalid data, AI failure, interrupted processing, duplicate submission, and permission changes.
10. Pass lint, typecheck, automated tests, accessibility checks, browser verification, and the production build.

## 18. Assumptions

- Manufacturers can mandate standard distributor templates and deadlines.
- Distributors retain and can report opening stock, onward sales, and closing stock.
- Manufacturers can export sales invoices, shipments, and credit notes.
- Return policies can be converted into versioned rules.
- Manufacturer/C&F staff can record receipt quantities and photographs.
- Monthly reporting is sufficient initially.
- Finance can record individual credits or import a standardized bulk file.
- Direct integrations can follow after the upload-driven MVP.
- English and INR are sufficient initially.
- One manufacturer workspace with multiple units and distributors is the initial tenancy pattern.
- The first pilot can use synthetic or approved de-identified data.

## 19. Open risks requiring industry validation

- Material financial or operational value of the current reconciliation problem.
- Reliability and availability of distributor secondary-sales and closing-stock data.
- Manufacturer leverage to enforce standard templates and deadlines.
- Real-world linkage between invoices, returns, receipts, approvals, and credits.
- Actual ownership of physical receipt verification.
- Formality and machine-readability of return policies.
- Credit-note grouping and finance workflows.
- Existing coverage from ERP, DMS, SANeForce, Pharmarack, or other systems.
- Representative file formats, monthly volumes, and processing expectations.
- Acceptable AI accuracy and manual-correction burden.
- Evidence retention, privacy, contractual, and AI-processing requirements.
- Buyer, budget, switching cost, and measurable pilot success criteria.

## 20. Required next documents

After approval of this specification:

1. Produce a proposed replacement `PLAN.md` based on this specification and verified current framework documentation.
2. Compare it with the existing `PLAN.md` and document retained, changed, deferred, and removed requirements.
3. Produce the revised design list and new design references.
4. Obtain approval for the plan and representative redesigned screens.
5. Update the application in the existing repository.
6. Remove obsolete routes, components, dependencies, and design files only after their replacements are verified and recoverable through Git.

