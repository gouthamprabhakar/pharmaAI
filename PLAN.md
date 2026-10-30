# PharmaAI Web MVP Implementation Plan

Status: approved product definition; ready for design consolidation and phased implementation
Product: PharmaAI
Repository: existing `pharmaAI` repository
Last updated: 29 October 2026

Implementation record (30 October 2026): see `PROGRESS.md`, `todo.md` and `BACKEND_SCREEN_CONTRACT.md`. Phase 3's server-side role/scope exit and genuine signed-in development browser checks pass. Development Organizations, verified membership, scoped invitation operations and signed event handling are implemented. Real webhook activation, observed external invitation delivery and native MFA verification remain release gates; MFA is optional only for explicitly configured development by user approval. Independent Phase 4 work follows this green development checkpoint under the blocker instructions. Phases 5–9 remain pending. The supported Webpack production builder is used because Turbopack's PostCSS worker cannot bind its internal port in this environment. Other product requirements and phase exits below are unchanged.

## 1. Authority and working agreement

This plan implements `MVP_SPEC.md`.

1. `MVP_SPEC.md` controls product purpose, workflows, evidence ownership, AI boundaries, screen consolidation, assumptions, and risks.
2. `PLAN.md` controls implementation order, architecture, routes, data, testing, migration, and cleanup.
3. `AGENTS.md` controls how coding agents operate inside this repository.

Work in this existing repository. Do not create a separate web project or repository. Keep prior work recoverable through Git while replacing obsolete designs and code deliberately.

## 2. Product outcome

PharmaAI is a responsive web application providing two controls for pharmaceutical manufacturers.

### Returns & Credits

Verify that a distributor return is supported by an original manufacturer sale, matches submitted and received evidence, complies with the applicable policy, receives a human decision, and is followed by the correct credit.

### Sales & Stock

Compare expected distributor closing inventory with distributor-reported closing inventory using opening stock, manufacturer shipments, onward sales, returns, transfers, damage, and approved adjustments.

PharmaAI is an evidence, reconciliation, and exception-management layer. It does not replace ERP, DMS, finance, accounting, or human approval systems.

> Combine manufacturer and distributor evidence, calculate what should reconcile, use AI to explain ambiguity and exceptions, and route human decisions through one auditable workflow.

## 3. Fixed scope

### Included

- Responsive browser application.
- Manufacturer and restricted distributor access.
- Standard versioned templates and reporting deadlines.
- Manufacturer invoice and shipment intake.
- Distributor return intake.
- Manufacturer/C&F receipt evidence and return photographs.
- AI-assisted image, PDF, and spreadsheet extraction.
- Rules-based return eligibility and credit calculation.
- Human return approval.
- Individual credit recording and standardized bulk credit import.
- Mandatory monthly distributor sales-and-stock reporting.
- Rules-based expected-stock calculation.
- AI-assisted matching, explanation, prioritization, and evidence-backed management questions.
- Shared Review Queue.
- Overview, reports, administration, notification panel, and audit history.
- Safe background work, retries, permissions, monitoring, and usage controls.

### Excluded from v1

- Native iOS or Android applications.
- Expo, React Native, NativeWind, EAS, or app-store workflows.
- Replacement of ERP, DMS, accounting, or finance systems.
- Autonomous approvals, credits, inventory changes, or exception closure.
- Deep ERP or distributor-system integrations.
- Advanced forecasting or automated stock redistribution.
- Patient-identifiable information.
- Self-service billing.
- Complex approval-chain configuration.
- Formal compliance-certification claims.

## 4. Non-negotiable principles

1. Deterministic calculations are authoritative.
2. AI is advisory, cited, confidence-labelled, correctable, and auditable.
3. Humans approve consequential decisions.
4. Original evidence and calculation snapshots are immutable.
5. Every material result links to supporting records.
6. Convex becomes the operational source of truth during the backend phase.
7. The server verifies identity, organization, role, unit, and distributor scope.
8. INR values use integer paise. Quantities and rates use exact decimal representation.
9. Side effects and jobs are idempotent.
10. Temporary states are not primary destinations.
11. Demo behavior never masquerades as a connected operation.
12. A variance never automatically implies wrongdoing.

## 5. Technology baseline

### Installed UI baseline

- Next.js `16.4.3` App Router.
- React and React DOM `19.3.1`.
- TypeScript `6.0.x`.
- Tailwind CSS `4.3.3`.
- ESLint `9.x`.
- Playwright `1.51.x`.

### Planned additions

- shadcn/ui accessible primitives.
- Clerk authentication, invitations, organizations, MFA, and re-verification.
- Convex operational data, realtime job state, mutations, actions, and scheduled work.
- A reviewed decimal library for exact calculation helpers.
- Authorization-gated file delivery and malware scanning.
- Server-side AI actions with structured output and versioned prompts.
- Error and uptime monitoring selected during production readiness.

Before changing framework APIs, read the relevant guide in `node_modules/next/dist/docs/`. Verify current Clerk, Convex, shadcn/ui, Tailwind, Playwright, and AI-provider guidance before implementation.

## 6. Information architecture

### Primary navigation

1. Overview.
2. Returns & Credits.
3. Sales & Stock.
4. Review Queue.

### Supporting navigation

5. Data Intake.
6. Reports.
7. Administration.

Notifications appear in the header. Audit history belongs under Administration. Processing, mapping, validation, extraction review, run history, and adjustments appear inside their owning workflow.

### Proposed routes

```text
/
/sign-in
/accept-invitation

/[orgSlug]/setup
/[orgSlug]/overview
/[orgSlug]/data
/[orgSlug]/data/new
/[orgSlug]/data/[importId]
/[orgSlug]/returns
/[orgSlug]/returns/[caseId]
/[orgSlug]/sales
/[orgSlug]/sales/variances/[varianceId]
/[orgSlug]/review
/[orgSlug]/reports
/[orgSlug]/admin
/[orgSlug]/admin/organization
/[orgSlug]/admin/units
/[orgSlug]/admin/products
/[orgSlug]/admin/distributors
/[orgSlug]/admin/templates
/[orgSlug]/admin/policies
/[orgSlug]/admin/team
/[orgSlug]/admin/security
/[orgSlug]/admin/ai-usage
/[orgSlug]/admin/audit
```

Keep route files thin. Put feature behavior in feature modules and server functions rather than page components.

## 7. Required views

### Landing

Explain both modules, evidence-linked AI, human control, and fictional demonstration status. Offer Sign In and Request Demo.

### Sign in and invitation

Use Clerk Google authentication only for the pilot. Add other sign-in or account-creation methods only after approval. Support verified invitations, organization context, role, and permitted scope, and do not allow uninvited distributor self-registration in v1.

### Guided setup

One resumable flow for organization, units, products, distributors, policies, templates, deadlines, team, and optional fictional sample data.

### Overview

Show fixed manufacturer context, permitted filters, returns, credits, sales/stock, reporting compliance, queue priorities, and an evidence-linked AI management summary. Every total drills into its records.

### Data Intake

Support manufacturer sales/shipments, distributor returns, receipt evidence, credit notes, and monthly distributor reports. Combine template downloads, upload, validation, correction, progress, and history. Use mapping only for approved legacy exceptions.

### Returns & Credits

Show cases by eligibility, clarification, approval, credit, overdue, exception, and closure status. Keep the finance worklist and credit history inside this area.

### Return Case Workspace

Show separate internal and distributor references, chronological evidence, submitted/received/eligible/approved quantities, financial components, policy version, AI explanation, citations, confidence, correction, approval controls, finance action, comments, ownership, deadlines, and audit history.

### Sales & Stock

Show reporting compliance, expected and reported stock, quantity and financial variance, status, and distributor/product/batch/region/period views.

### Variance Workspace

Show the full calculation, source evidence, AI explanation and confidence, recurrence, corrected-data request, evidenced adjustment, escalation, resolution reason, owner, and audit history.

### Review Queue

Combine Return, Finance, Sales, Inventory, and Data exceptions. Route by team and owner. Show priority, exposure, age, due date, evidence quality, AI recommendation, integrated detail, resolution, and reopening history.

### Reports

Provide Executive, Returns & Credits, Sales & Stock, Reporting Compliance, and Review Queue views. Support scoped export and evidence-backed management questions.

### Administration

Contain organization, units, products, aliases, distributors, templates, policies, tolerances, deadlines, team, permissions, security, AI usage, and audit history.

## 8. Roles and authorization

| Capability | Owner | Administrator | Returns Reviewer | Finance User | Sales Reviewer | Viewer | Distributor User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View permitted manufacturer records | Yes | Yes | Scoped | Scoped | Scoped | Read only | No |
| Manage organization/configuration | Yes | Yes | No | No | No | No | No |
| Invite users | Yes | Yes | No | No | No | No | No |
| Upload manufacturer evidence | Yes | Yes | Returns | Credits | Sales | No | No |
| Submit distributor return/report | On behalf | On behalf | No | No | No | No | Own distributor |
| Review return eligibility | Yes | Yes | Yes | No | No | No | No |
| Record/import issued credits | Yes | Yes | No | Yes | No | No | No |
| Resolve sales/stock variances | Yes | Yes | No | No | Yes | No | No |
| View executive reports | Yes | Yes | Scoped | Scoped | Scoped | Yes | No |
| Export data | Yes | Configurable | Explicit grant | Explicit grant | Explicit grant | No | No |

Rules:

- Owner and Administrator MFA is required.
- User-approved development exception (30 October 2026): an explicit opt-in may make MFA/reverification optional only when the deployment is marked development and uses a Clerk development issuer. Identity, membership, roles and scopes remain required; production and real client use require the full security controls. Track deferred work in `todo.md` without claiming unfinished phase gates passed.
- The final Owner cannot be removed.
- Sensitive exports, ownership, security, and access changes require re-verification.
- Removal blocks future access but preserves historical identity.
- Distributor users are restricted to their distributor and permitted submission statuses.
- Convex public functions derive signed-in identity and verify membership and scope.

## 9. Evidence ownership

| Information | Authoritative source |
|---|---|
| Identity and organization membership | Clerk plus application membership |
| Products and product codes | Manufacturer product master |
| Units and distributors | Manufacturer configuration |
| Sales invoices and shipments | Manufacturer ERP/export |
| Return request | Distributor submission |
| Physical receipt and photographs | Manufacturer/C&F record |
| Return policy | Versioned manufacturer policy |
| Eligibility and expected credit | Deterministic calculation |
| Approval decision | Authorized reviewer |
| Issued credit | Manufacturer finance system or authorized finance user |
| Onward sales and reported stock | Distributor monthly report |
| Expected closing stock | Deterministic calculation |
| AI output | Advisory metadata linked to evidence |

## 10. Core data model

Use strict Convex validators and tenant-leading indexes. Preserve organization, unit, distributor, evidence, version, actor, and audit scope.

### Identity and configuration

- `users`, `organizations`, `memberships`, `membershipUnits`, `operationalUnits`, `invitations`.
- `distributors`, `products`, `productAliases`, `batches`.
- `templates`, `reportingObligations`, `policyVersions`, `toleranceVersions`.

### Files and intake

- `files`, `imports`, `importMappings`, `importRows`.
- `documents`, `extractionDrafts`.

Files retain checksum, purpose, scan state, uploader, scope, retention state, and protected-delivery metadata. Corrections create a new version or superseding import.

### Returns and credits

- `returnCases`, `returnLines`.
- `receiptRecords`, `receiptLines`.
- `returnDecisions`.
- `creditNotes`, `creditNoteLines`, `creditMatches`.

Preserve submitted, received, eligible, approved, and credited quantities separately. Preserve gross, deduction, tax, expected, issued, and outstanding paise separately.

### Sales and stock

- `primarySales`, `secondarySales`.
- `inventoryMovements`, `inventorySnapshots`, `adjustments`.
- `reportingSubmissions`.

Every movement retains distributor, unit, product, optional batch, exact quantity, optional value, source, and provenance.

### Reconciliation and review

- `reconciliationPeriods`, `reconciliationRuns`, `reconciliationResults`.
- `recordMatches`, `discrepancies`.
- `reviewItems`, `reviewEvents`, `comments`, `attachments`.

Use stable discrepancy fingerprints so reruns update or reopen the same issue instead of duplicating it.

### Operations

- `jobs`, `notifications`, `notificationPreferences`.
- `auditEvents`, `usageCounters`, `idempotencyKeys`.

Audit events are append-only.

## 11. Returns lifecycle

### Evidence order

1. Original sales invoice.
2. Distributor return request.
3. Manufacturer/C&F receipt and photographs.
4. Eligibility result and policy version.
5. Human approval.
6. Manufacturer-issued credit.

### States

```text
Submitted
  -> Evidence processing
  -> Awaiting eligibility review
      -> Clarification requested
      -> Rejected
      -> Approved - awaiting credit
          -> Partially credited
          -> Credit overdue
          -> Confirmed and closed
```

`Needs attention` is a warning or queue condition, not the starting state.

### Rules

- Prove the original sale at invoice-line level when possible.
- Match deterministic identifiers before AI suggestions.
- Apply the policy version effective for the relevant business date.
- Calculate eligible quantity and expected credit with exact arithmetic.
- Keep deductions, taxes, and tolerances explicit.
- Require human confirmation for ambiguity and overrides.
- Compare issued credit with expected credit; never infer issuance from approval.

## 12. Sales and stock lifecycle

### Required monthly inputs

- Opening stock.
- Manufacturer receipts/primary sales.
- Onward/secondary sales.
- Customer returns.
- Returns to manufacturer.
- Transfers in/out.
- Damage/write-off.
- Approved adjustments.
- Reported closing stock.

### Equation

```text
Expected closing stock
  = opening stock
  + manufacturer receipts
  + customer returns
  + transfers in
  - onward sales
  - returns to manufacturer
  - damage/write-off
  - transfers out
  +/- approved adjustments
```

### Report states

```text
Draft -> Submitted -> Validating -> Correction required / Accepted
Accepted -> Replaced by corrected report
```

Track compliance separately as `On time`, `Overdue`, `Non-compliant`, or `Waived with reason`.

### Variance states

```text
Calculated
  -> Within tolerance
  -> Investigation required
      -> Awaiting distributor correction
      -> Awaiting internal action
      -> Resolved
      -> Carried forward
```

## 13. AI architecture

### Allowed work

- Extract fields from images, PDFs, and spreadsheets.
- Suggest product, distributor, invoice, batch, return, and credit matches.
- Explain discrepancies using cited records and policy clauses.
- Summarize cases.
- Rank exceptions using exposure, age, recurrence, evidence quality, and deadlines.
- Answer authorized management questions with citations.

### Required metadata

- Provider/model and prompt/schema versions.
- Input evidence references.
- Structured output and confidence.
- Warnings and missing evidence.
- User confirmation/correction.
- Token/cost estimate, correlation ID, and timestamps.

### Prohibited work

AI cannot approve or reject returns, calculate authoritative totals, issue credits, change inventory, resolve exceptions, modify policies, grant access, or present uncited claims as facts.

### Execution rules

1. Try exact identifiers and saved mappings first.
2. Call AI only for ambiguity or requested explanation.
3. Validate structured output server-side.
4. Persist drafts separately from confirmed data.
5. Require review when confidence or evidence is insufficient.
6. Cache unchanged evidence by checksum and version.
7. Fall back to manual work when AI fails or limits are reached.
8. Never silently substitute a model or prompt version.

## 14. Intake and validation

### Supported inputs

- CSV and XLSX standard templates.
- Approved PDF and image evidence.
- Final size limits selected after current Convex and scanning limits are verified.

### Validation order

1. Authorization and intended scope.
2. File type, size, checksum, and security scan.
3. Prohibited-data screening.
4. Template and version.
5. Required columns and fields.
6. Dates, quantities, money, codes, and allowed values.
7. Duplicate file and row detection.
8. Internal totals and period consistency.
9. Product, batch, distributor, invoice, and unit relationships.
10. Row-level valid, warning, invalid, or excluded result.

Validation decides whether data is usable. Reconciliation decides whether independent records agree.

### Mapping policy

- Standard templates are mandatory for routine distributor submissions.
- One-time legacy mapping may be configured during onboarding or transition.
- Confirmed mappings are versioned and source-scoped.
- Routine users do not repeatedly map unchanged formats.
- Ambiguity becomes an exception, not a new internal field definition.

## 15. Background jobs

Use a Convex `jobs` table with scheduled internal functions before introducing another queue service.

### Jobs

- File scan, parse, validate, and confirm.
- Document/image extraction.
- Product/entity normalization and record matching.
- Returns and Sales reconciliation.
- AI explanation.
- Export and notification.
- Retention/deletion work.

### Pattern

1. Authorized mutation creates or reuses a job with a stable idempotency key.
2. A short mutation claims a bounded step.
3. An action performs external or CPU-heavy work.
4. An internal mutation validates and persists output, usage, progress, and audit metadata.
5. The next step is scheduled.
6. Temporary failures retry with bounded backoff and jitter.
7. Permanent failures expose a safe category and support reference.

Chunk large work according to verified current Convex limits. User-visible states are `Queued`, `Processing`, `Needs correction`, `Completed`, and `Failed`. Show real steps and counts, not fabricated percentages.

## 16. Review Queue

Categories are Returns Operations, Finance/Credit, Sales/Inventory, and Data/Import.

```text
Open -> Assigned -> In review -> Awaiting external response -> Resolved
Resolved -> Reopened
```

Status and outcome are separate. Every resolution stores outcome, reason, actor, evidence, before/after state, and audit event. Access respects role, team, unit, and distributor scope. AI priority is advisory and explains its factors.

## 17. Security and privacy

- Clerk manages identity, invitation, organization, and re-verification.
- Convex helpers verify membership, unit, distributor, and permission for every protected function.
- Tenant-owned references must share the same organization.
- Sensitive files require authorization-gated delivery.
- Owners and Administrators require MFA.
- Sensitive exports and access changes require step-up verification.
- Patient-identifiable information is prohibited in data, files, logs, analytics, errors, and AI prompts.
- External actions receive minimum necessary evidence.
- Secrets stay in protected environment configuration.
- Audit records are append-only.
- Production retention and deletion rules require pilot legal/security approval.

## 18. Web UX and accessibility

- Desktop is the primary work surface; tablet and mobile browsers retain essential tasks.
- Use responsive menus rather than native-app navigation patterns.
- Use semantic HTML, keyboard navigation, visible focus, accessible names, sufficient contrast, and screen-reader status updates.
- Keep INR amounts and quantities readable.
- Avoid page-level horizontal overflow; contain table scrolling only where reflow would destroy meaning.
- Use pagination or virtualization for large data.
- Preserve relevant filters through detail and browser-back navigation.
- Empty states identify the next required action.
- Errors preserve work and provide safe recovery.
- Support current Chrome, Edge, Safari, and Firefox according to bundled Next.js guidance.

## 19. Environments and monitoring

### Environments

- Local development.
- Staging with fictional or explicitly approved de-identified data.
- Production with separate Clerk, Convex, hosting, secrets, AI, storage, and monitoring configuration.

### Monitor

- Authentication and authorization failures.
- File scan, parse, validation, and confirmation outcomes.
- Reconciliation completion and failure.
- Background retries and permanent failures.
- AI latency, output validation, usage, and estimated cost.
- Overdue reports and high-value unresolved exceptions.
- Application errors and slow operations.
- Consequential audit events.

Sensitive evidence never enters ordinary logs.

## 20. Implementation phases

### Phase 0 — Preserve and baseline

- Record current Git state.
- Keep `MVP_SPEC.md`, `PLAN.md`, and `AGENTS.md` aligned.
- Inventory routes, components, dependencies, designs, tests, and generated outputs.
- Preserve unrelated user changes.
- List every removal target and replacement.

**Exit:** current state is recoverable and every removal has a reason.

### Phase 1 — Design and navigation consolidation

- Create the approved 12-view reference set.
- Implement the simplified shell and route map.
- Remove obsolete primary destinations.
- Build shared responsive, accessibility, table, filter, status, evidence, AI-assistance, and feedback components.
- Keep behavior explicitly fictional.

Implement representative Overview, Return Case Workspace, and Variance Workspace first.

**Exit:** representative designs and responsive implementations are approved.

### Phase 2 — Complete interactive UI demonstration

- Implement remaining views and consolidated states.
- Add safe fictional state transitions for both complete workflows.
- Add fictional templates and evidence.
- Make safe actions navigate or update demo state instead of stopping at generic messages.
- Keep persistent demo disclosure.

**Exit:** both workflows can be demonstrated end-to-end without implying persistence.

### Phase 3 — Clerk and authorization

- Configure Clerk from current official guidance.
- Add sign-in, invitations, organizations, roles, MFA, and re-verification.
- Configure Convex authentication and authorization helpers.
- Implement manufacturer and restricted distributor access.

**Exit:** server-side role and scope tests pass.

### Phase 4 — Convex data foundation

- Implement strict schema validators, indexes, audit, idempotency, exact money/quantity helpers, and configuration.
- Implement organization, units, products, distributors, templates, policies, deadlines, team, and permissions.
- Seed fictional data only outside production.

**Exit:** configuration is persistent, authorized, audited, and testable.

### Phase 5 — Data Intake

- Implement protected upload, security scan, parse, validation, correction, confirmation, versioning, and evidence access.
- Add template downloads, legacy mappings, resumable progress, and duplicate prevention.

**Exit:** representative inputs produce confirmed normalized records without duplication.

### Phase 6 — Returns & Credits vertical slice

- Implement distributor submission, receipt records/photos, AI extraction/matching, deterministic eligibility/credit, human decision, finance worklist, credit entry/import, matching, overdue, partial, and closure.

**Exit:** one return completes from submission to audited credit closure.

### Phase 7 — Sales & Stock vertical slice

- Implement monthly obligations, shipment/report intake, stock calculation, tolerance, variance, AI explanation, correction, adjustment, escalation, resolution, and carry-forward.

**Exit:** one monthly report completes from submission to audited resolution.

### Phase 8 — Queue, reports, and management AI

- Add team routing, ownership, priority, deadlines, exposure, recurrence, comments, attachments, and reopening.
- Implement scoped reports/exports and evidence-backed management questions.

**Exit:** every reported number and AI answer can be traced to evidence.

### Phase 9 — Production readiness and cleanup

- Add monitoring, limits, retention decisions, support-safe errors, and usage controls.
- Complete browser, accessibility, security, performance, and recovery testing.
- Remove obsolete routes, components, dependencies, outputs, and superseded designs after replacement verification.
- Update README and operational guidance.

**Exit:** definition-of-done requirements pass in staging and production build is approved.

## 21. Testing

### Unit

- Money, quantity, tax, tolerance, and stock equations.
- Policy-version selection.
- Return eligibility and credit matching.
- Status transitions, fingerprints, and idempotency.

### Integration

- Role, unit, and distributor authorization.
- Import scan/parse/validate/confirm.
- Duplicate and retry behavior.
- AI structured-output validation and fallback.
- Historical run immutability and audit creation.

### End-to-end

- Manufacturer setup.
- Restricted distributor submission.
- Return receipt, extraction, review, approval, credit, and closure.
- Monthly report, calculation, variance, investigation, and resolution.
- Queue routing/reopening and scoped reporting/export.
- Empty, invalid, failed, overdue, and denied states.

### UI/accessibility

- Approved reference comparison.
- Desktop, 1280, 1024, tablet, and mobile browser widths.
- Keyboard operation, focus, names, announcements, contrast, wrapping, clipping, and table overflow.
- Current supported Chrome, Edge, Safari, and Firefox.

Required project checks:

```text
npm run lint
npm run typecheck
npm run test:e2e
npm run build
```

## 22. Design and code cleanup map

| Previous destination | New treatment |
|---|---|
| Workspace invitation | Sign-in/invitation state |
| Four onboarding pages | One guided setup |
| Import processing | In-flow progress |
| Column mapping | Setup/exception dialog |
| Validation results | Data Intake step |
| Document extraction review | Case/variance evidence confirmation |
| Manufacturer credit notes | Returns finance worklist/history |
| Returns runs | Administration audit history |
| Distributor inventory | Sales & Stock view |
| Inventory adjustment | Variance action |
| Sales runs | Administration audit history |
| Review item detail | Integrated queue detail |
| Notifications page | Header panel/preferences |
| Team, audit, and settings subpages | Administration sections |
| System edge states page | Reusable patterns only |

The exact decision for all 35 existing reference images is recorded in `MVP_SPEC.md`.

## 23. Legacy-plan reconciliation

### Retained

- Web-first Next.js, TypeScript, Tailwind, shadcn/ui, Clerk, and Convex direction.
- Tenant/unit authorization, immutable evidence, exact money, versioned rules, idempotency, jobs, and audit history.
- Returns, sales, review, reporting, administration, monitoring, and testing requirements.
- Human-controlled decisions.

### Changed

- Two explicit business controls replace a broad reconciliation concept.
- Four primary work areas replace many equal destinations.
- Distributor submission and reporting obligations are explicit.
- Manufacturer/C&F receipt photographs are in the Returns MVP.
- AI is visible and limited to evidence/ambiguity work.
- Thirty-five apparent destinations consolidate into twelve views.
- Credit issuance is an integrated finance worklist.

### Deferred

- Deep integrations, forecasting, redistribution, complex approvals, billing, certification work, and additional languages/currencies.

### Removed

- Native implementation.
- Routine repeated mapping.
- Processing/runs as normal destinations.
- Standalone notification and edge-state pages.
- Any implication that AI owns arithmetic or autonomous decisions.

## 24. Definition of done

The MVP is complete only when a fictional manufacturer can:

1. Configure organization, products, distributors, templates, policies, deadlines, and team.
2. Invite internal and restricted distributor users.
3. Complete a return from submission through receipt, eligibility, approval, credit, and closure.
4. Complete a monthly report through validation, stock calculation, variance investigation, and resolution.
5. See AI extraction, matching, explanation, prioritization, confidence, correction, and citations.
6. Route exceptions through the shared queue.
7. View scoped reports and audit history.
8. Use essential functions across supported browser widths and keyboard navigation.
9. Recover safely from invalid data, AI failure, interruption, duplication, and permission change.
10. Pass lint, typecheck, automated tests, accessibility checks, browser verification, and production build.

## 25. Unvalidated risks and pilot gates

Validate before production rollout:

- Financial and operational importance of the problem.
- Availability and reliability of distributor sales/stock data.
- Manufacturer ability to enforce templates and deadlines.
- Actual invoice-to-return-to-credit workflow.
- Ownership of physical receipt verification.
- Return-policy structure.
- Credit-note grouping and finance process.
- Existing coverage/exportability from ERP, DMS, SANeForce, Pharmarack, and other systems.
- Representative files, volumes, and performance expectations.
- Acceptable AI accuracy and correction burden.
- Retention, privacy, contractual, and AI-processing requirements.
- Buyer, budget, switching cost, and measurable pilot success criteria.

Use explicit assumptions until interviews or pilot evidence resolve these points. Never present unvalidated hypotheses as customer facts.
