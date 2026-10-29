# PharmaAI v1 Implementation Plan

Status: web UI foundation implemented; backend and data phases remain planned
Product: PharmaAI  
Target repository: the existing `pharmaAI` workspace and repository
Last updated: 28 October 2026

> Implement this web-first plan in the existing `pharmaAI` workspace and repository. Migrate the current Expo/React Native prototype in place to the web stack below. Preserve design references, relevant assets, product content, and unrelated user changes. Do not create a separate repository. The landing-page UI has been converted to Next.js in place. The project is still in the UI phase; Clerk authentication, Convex, real data, and backend workflows are not implemented. Native iOS and Android applications remain outside scope.

## 1. Goal and v1 boundary

PharmaAI is an India-focused, responsive web platform for pharmaceutical manufacturers such as Micro Labs. It imports operational reports from distributors and stockists, reconciles product returns against approvals and credit notes, reconciles primary sales against distributor-reported secondary sales and closing inventory, and sends every material exception to one auditable Review Queue.

Micro Labs is the initial target and possible pilot opportunity, not a hard-coded tenant or the only intended customer. The reusable customer category is an Indian pharmaceutical manufacturer with multiple divisions, depots, C&F agents, regions, distributors, or stockists.

PharmaAI has two connected modules:

- **Returns Recon:** Why was stock returned, was it eligible and approved, and did the manufacturer issue the correct credit note?
- **Sales Recon:** Do primary sales, distributor-reported secondary sales, returns, adjustments, and remaining distributor inventory reconcile?

The key v1 outcome is:

> A pharmaceutical manufacturer can upload reports from its own systems and from distributors or stockists, confirm the mappings, run deterministic reconciliation, and see evidence-backed credit-note and sales/inventory exceptions without manually comparing dozens of spreadsheets.

AI assists with column mapping, document extraction, product normalization, suggested matching, explanations, and prioritization. It never approves credits, changes financial records, creates confirmed inventory adjustments, or resolves exceptions without a user decision.

### Explicitly out of scope

- Direct ERP, distributor-management-system, stockist, or distributor API integrations
- Scheduled or recurring imports
- Native Android or iOS applications
- Expo, React Native, NativeWind, or mobile-app code
- Full offline operation
- Patient-identifiable information
- Autonomous financial decisions
- Self-service billing
- FIFO or other advanced inventory valuation methods
- Custom saved Review Queue views
- Complex configurable approval chains
- Formal SOC 2, HIPAA, DPDP, or similar certification claims

### Product-alignment guardrails

- Do not reposition the product as software for independent pharmacies.
- Do not label manufacturer operating units as retail pharmacy locations.
- Do not imply that PharmaAI connects directly to distributor systems in v1; v1 uses uploads and confirmed manual records.
- Use synthetic manufacturer, distributor, stockist, product, invoice, return, credit-note, secondary-sales, and closing-stock data in demos.
- Never present Micro Labs, GreenCross, or any other real or fictional entity as an actual customer unless that relationship is verified and approved for publication.
- The commercial hypothesis remains unvalidated until a manufacturer confirms the problem, supplies representative de-identified files, and identifies a credible pilot path.

## 2. Architecture principles

1. **Deterministic calculations are authoritative.** AI suggestions never become financial or inventory truth without confirmation.
2. **Convex is the operational source of truth.** The UI does not declare a mutation successful until Convex confirms it.
3. **Tenant scope is derived, never trusted.** Every public Convex function derives the signed-in user and active Clerk organization, loads the application membership, and verifies operational-unit access. Client-supplied workspace and operational-unit IDs are always checked.
4. **Evidence is immutable.** Original files, confirmed import rows, rule versions, calculation inputs, and historical reconciliation runs remain reproducible.
5. **Side effects are idempotent.** Upload completion, parsing, AI calls, reconciliation, email, and retries use stable idempotency keys.
6. **Money never uses binary floating point.** Persist INR as integer paise. Persist fractional quantities and rates as normalized decimal strings, calculate with a decimal library, and round final INR totals to two decimal places.
7. **Private files are authorization-gated.** Do not expose raw Convex storage URLs for customer evidence. Convex documents that generated storage URLs are bearer URLs; deliver files through an authorization-checked HTTP action or another reviewed private delivery mechanism. Validate the HTTP-action size limit against the final upload cap.
8. **External calls happen in actions.** Database state changes happen in mutations. Actions call OpenAI, Resend, Cloudmersive, Sentry, or other external services and then commit validated results through internal mutations.
9. **No silent model substitution.** OpenAI model IDs and prompt versions live in secure server configuration. A persistent failure sends work to manual review.
10. **Build the thin end-to-end path first.** Complete one representative upload-to-queue workflow before adding breadth and dashboard polish.

## 3. Proposed repository structure

```text
pharmaAI/
├── AGENTS.md
├── README.md
├── PLAN.md
├── package.json
├── next.config.ts
├── proxy.ts                         # Current Next.js request-boundary convention; verify at setup
├── instrumentation.ts              # Sentry/server instrumentation
├── components.json                 # shadcn/ui configuration
├── eslint.config.mjs
├── tsconfig.json
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── security.yml
├── public/
│   └── samples/                    # Synthetic sample import files only
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   ├── accept-invitation/page.tsx
│   │   │   └── privacy/page.tsx
│   │   ├── (onboarding)/onboarding/
│   │   │   ├── organization/page.tsx
│   │   │   ├── operational-unit/page.tsx
│   │   │   ├── distributor/page.tsx
│   │   │   └── demo/page.tsx
│   │   ├── (app)/[orgSlug]/
│   │   │   ├── layout.tsx
│   │   │   ├── overview/page.tsx
│   │   │   ├── returns/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [returnId]/page.tsx
│   │   │   │   ├── credit-notes/page.tsx
│   │   │   │   └── runs/page.tsx
│   │   │   ├── sales/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── variances/[resultId]/page.tsx
│   │   │   │   ├── inventory/page.tsx
│   │   │   │   └── runs/page.tsx
│   │   │   ├── review/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [itemId]/page.tsx
│   │   │   ├── imports/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [importId]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── mapping/page.tsx
│   │   │   │       └── review/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── team/page.tsx
│   │   │   ├── audit/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── operational-units/page.tsx
│   │   │       ├── distributors/page.tsx
│   │   │       ├── rules/page.tsx
│   │   │       └── security/page.tsx
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── not-found.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── shell/
│   │   ├── data-table/
│   │   ├── forms/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── onboarding/
│   │   ├── imports/
│   │   ├── returns/
│   │   ├── sales/
│   │   ├── review-queue/
│   │   ├── ai/
│   │   ├── notifications/
│   │   └── audit/
│   ├── lib/
│   │   ├── auth/
│   │   ├── decimal/
│   │   ├── dates/
│   │   ├── files/
│   │   ├── validation/
│   │   ├── telemetry/
│   │   └── constants/
│   └── providers/
│       └── app-providers.tsx
├── convex/
│   ├── _generated/
│   ├── schema.ts
│   ├── auth.config.ts
│   ├── crons.ts
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── permissions.ts
│   │   ├── tenancy.ts
│   │   ├── audit.ts
│   │   ├── idempotency.ts
│   │   ├── money.ts
│   │   └── jobs.ts
│   ├── users.ts
│   ├── organizations.ts
│   ├── operationalUnits.ts
│   ├── distributors.ts
│   ├── invitations.ts
│   ├── files.ts
│   ├── imports.ts
│   ├── products.ts
│   ├── returns.ts
│   ├── sales.ts
│   ├── reconciliations.ts
│   ├── reviewQueue.ts
│   ├── notifications.ts
│   ├── audit.ts
│   ├── usage.ts
│   ├── http.ts
│   └── jobs/
│       ├── orchestrator.ts
│       ├── malwareScan.ts
│       ├── parseImport.ts
│       ├── extractDocument.ts
│       ├── matchRecords.ts
│       ├── reconcileReturns.ts
│       ├── reconcileSales.ts
│       └── sendNotification.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/                   # Synthetic, de-identified fixtures
│   └── e2e/
└── scripts/
    ├── seed-synthetic.ts
    └── verify-env.ts
```

Keep route files thin. Domain calculations belong in independently testable modules used by Convex functions, not in React components.

## 4. Page and navigation map

### Public and onboarding

| Route | Purpose |
|---|---|
| `/` | Public product page or redirect for signed-in users |
| `/sign-in` | Google and email one-time-code sign-in |
| `/accept-invitation` | Verified-email invitation acceptance |
| `/privacy` | Published privacy notice |
| `/onboarding/organization` | Create the first organization |
| `/onboarding/operational-unit` | Create the first manufacturer operational unit |
| `/onboarding/distributor` | Select or add the first distributor |
| `/onboarding/demo` | Optional demo dataset or sample download |

### Authenticated application

| Primary area | Routes | Notes |
|---|---|---|
| Overview | `/[orgSlug]/overview` | Current month by default; every metric drills into filtered evidence |
| Returns Recon | `/[orgSlug]/returns`, `/returns/[returnId]`, `/returns/credit-notes`, `/returns/runs` | Return-case top-level rows |
| Sales Recon | `/[orgSlug]/sales`, `/sales/variances/[resultId]`, `/sales/inventory`, `/sales/runs` | Product + distributor/stockist rows, optionally scoped by operational unit and expandable to batch |
| Review Queue | `/[orgSlug]/review`, `/review/[itemId]` | Desktop split workspace; small-screen list-to-detail flow |
| Import Centre | `/[orgSlug]/imports/**` | Upload, mapping, validation, confirmation, job progress |
| Supporting areas | `/documents`, `/reports`, `/notifications`, `/team`, `/audit`, `/settings/**` | Secondary navigation or user menu |

Desktop uses a persistent left sidebar. Tablet uses a remembered collapsible sidebar. Mobile web uses a compact header and bottom navigation for the four primary areas. Organization, operational-unit scope, and reporting period remain visible. Filters survive detail navigation and browser back operations.

## 5. Role-permission matrix

Use Clerk Organizations for authentication, active-organization context, and organization roles. Mirror the minimum application membership data in Convex for operational-unit access, export grants, status, and audit linkage. Prefer custom permissions in authorization helpers, but verify Clerk plan requirements before committing to production custom roles.

| Capability | Owner | Administrator | Analyst | Viewer |
|---|:---:|:---:|:---:|:---:|
| View permitted records and dashboards | Yes | Yes | Yes | Yes |
| Access all operational units | Yes | Configurable | Configurable | Configurable |
| Create/manage operational units | Yes | Yes | No | No |
| Invite/remove non-Owner users | Yes | Yes | No | No |
| Assign roles/operational-unit access | Yes | Admin/Analyst/Viewer only | No | No |
| Configure distributors/rules | Yes | Yes | No | No |
| Upload and map imports | Yes | Yes | Yes | No |
| Confirm operational imports | Yes | Yes | Yes | No |
| Void/supersede confirmed imports | Yes | Yes | No | No |
| Run reconciliation | Yes | Yes | Yes | No |
| Manage/resolve/reopen queue items | Yes | Yes | Yes | No |
| Override priority with reason | Yes | Yes | Yes | No |
| Create confirmed adjustment | Yes | Yes | Yes | No |
| Export operational data | Yes | Yes | Explicit grant | No by default |
| Export full organization/audit data | Re-verification | No unless explicitly delegated | No | No |
| Manage billing/pilot settings | Yes | Limited explicit grant | No | No |
| Transfer ownership | Re-verification | No | No | No |
| Delete organization | Re-verification | No | No | No |

Rules:

- Owners and Administrators require MFA.
- The final Owner cannot be removed.
- Sensitive exports, ownership transfer, organization deletion, administrative-access changes, and future billing changes require Clerk re-verification.
- Removal revokes access immediately, unassigns active work, and preserves historical identity.
- A user may have different roles in different organizations and access only selected operational units.
- UI checks improve usability; Convex checks provide security. Never treat hidden UI as authorization.

## 6. Initial Convex schema

The schema below is a logical starting point, not final field-level code. Use strict Convex validators and deliberate indexes. Do not add generic unindexed queries over tenant data.

### Identity and tenancy

| Table | Core fields | Required indexes |
|---|---|---|
| `users` | `clerkUserId`, display name, verified email snapshot, status, lastSeenAt | `by_clerk_user` |
| `organizations` | `clerkOrgId`, slug, name, timezone, currency, locale, deletionState, deletionRequestedAt | `by_clerk_org`, `by_slug` |
| `memberships` | `workspaceId`, `userId`, `clerkMembershipId`, role, status, organizationWide, exportAllowed | `by_workspace_user`, `by_user_status`, `by_clerk_membership` |
| `membershipUnits` | `workspaceId`, `membershipId`, `unitId` | `by_membership`, `by_unit_membership` |
| `operationalUnits` | `workspaceId`, code, name, type (`division`, `depot`, `cfa`, `region`, `other`), optional parent unit, address summary, timezone override, active | `by_workspace`, `by_workspace_code`, `by_parent` |
| `invitations` | `workspaceId`, Clerk invitation ID, email hash/snapshot, role, operational-unit scope, status, expiresAt, replacedBy | `by_workspace_status`, `by_clerk_invitation` |

### Configuration and product master

| Table | Core fields | Required indexes |
|---|---|---|
| `distributors` | `workspaceId`, code, name, partner type (`distributor`, `stockist`, `superStockist`), territory, linked operational unit, tax identifiers, aliases, active | `by_workspace`, `by_workspace_code`, `by_unit_active` |
| `distributorRuleVersions` | `workspaceId`, `distributorId`, version, effectiveFrom/To, return-eligibility rules, credit basis, credit-start event, credit period, deductions/tax/tolerance configuration, status | `by_distributor_version`, `by_workspace_effective` |
| `products` | `workspaceId`, immutable product ID, GTIN/barcode, org SKU, manufacturer, brand/generic name, strength, form, pack, UOM, HSN, GST rate, active | `by_workspace_gtin`, `by_workspace_sku`, `by_workspace_active` |
| `productAliases` | `workspaceId`, `productId`, source/distributor, external code, normalized description, pack description, conversion, confirmedBy | `by_workspace_source_code`, `by_product` |
| `batches` | `workspaceId`, optional `unitId`, `productId`, lot number, manufacture/expiry dates, manufacturer invoice rate/credit basis | `by_unit_product_lot`, `by_product_expiry` |

### Files and imports

| Table | Core fields | Required indexes |
|---|---|---|
| `files` | `workspaceId`, optional `unitId`, storage ID, original name, MIME, bytes, checksum, purpose, quarantine/scan state, uploadedBy, retention state | `by_workspace_checksum`, `by_scan_state`, `by_workspace_purpose` |
| `imports` | `workspaceId`, optional `unitId`, optional `distributorId`, file ID, type, source system/partner, period, internal state, user-visible state, mapping version, counts, checksum, idempotency key, confirmed/voided/superseded metadata | `by_workspace_state`, `by_unit_type_period`, `by_distributor_type_period`, `by_idempotency`, `by_workspace_checksum` |
| `importMappings` | `workspaceId`, import ID, source columns, target fields, transformations, AI suggestions, confirmed mapping, version | `by_import_version` |
| `importRows` | `workspaceId`, optional `unitId`, optional `distributorId`, import ID, row number, source snapshot, normalized data, validation outcome, errors/warnings, created-record reference | `by_import_row`, `by_import_outcome` |
| `documents` | `workspaceId`, optional `unitId`, optional `distributorId`, file ID, document type, source system/partner, extraction state, confirmed record references | `by_workspace_type`, `by_extraction_state` |
| `extractionDrafts` | `workspaceId`, document ID, prompt/model/version metadata, structured fields, field confidence, warnings, status, confirmedBy | `by_document`, `by_status` |

### Operational records

| Table | Core fields | Required indexes |
|---|---|---|
| `primarySales` | `workspaceId`, `unitId`, `distributorId`, manufacturer invoice/reference, date, product/batch, quantity, rate/value/tax paise, import provenance | `by_distributor_date`, `by_invoice`, `by_product_date` |
| `secondarySales` | `workspaceId`, `unitId`, `distributorId`, reporting period/date, product/batch, quantity, value paise when supplied, import provenance | `by_distributor_period`, `by_product_date` |
| `returnCases` | `workspaceId`, `unitId`, `distributorId`, distributor return/claim reference, original invoice references, reason, dispatch/receipt/approval dates, status, import provenance, aggregate paise values | `by_unit_date`, `by_workspace_reference`, `by_distributor_status` |
| `returnLines` | `workspaceId`, `unitId`, `distributorId`, return case, product, batch, submitted/received/accepted/rejected quantities, original invoice rate, eligible credit basis, deductions, approval state, expected-credit components, rule version, source row | `by_return`, `by_product_date`, `by_credit_status` |
| `creditNotes` | `workspaceId`, `unitId`, `distributorId`, manufacturer-issued reference, date, GST-exclusive/tax/total paise, import/document provenance | `by_workspace_reference`, `by_distributor_date` |
| `creditNoteLines` | `workspaceId`, `unitId`, `distributorId`, credit note, product/batch, quantity, amount/tax paise, source row | `by_credit_note`, `by_product_date` |
| `inventoryMovements` | `workspaceId`, `unitId`, `distributorId`, product, optional batch, type (`primarySale`, `secondarySale`, `retailerReturn`, `returnToManufacturer`, `writeOff`, `transferIn`, `transferOut`, `adjustment`), date/time, quantity decimal, value paise, provenance | `by_distributor_period`, `by_unit_product_date`, `by_import` |
| `inventorySnapshots` | `workspaceId`, `unitId`, `distributorId`, product, optional batch, snapshot date/time, quantity decimal, value paise, kind (`opening`, `closing`, `physical`, `system`) | `by_distributor_date`, `by_unit_product_date` |
| `adjustments` | `workspaceId`, `unitId`, `distributorId`, product/batch, type, quantity/value, reason, note, attachment, confirmedBy, effectiveAt | `by_distributor_date`, `by_product_date` |

### Reconciliation and queue

| Table | Core fields | Required indexes |
|---|---|---|
| `reconciliationPeriods` | `workspaceId`, optional operational-unit scope, type, start/end in org timezone, status, lock/reopen metadata, currentReviewedRunId | `by_workspace_type_period`, `by_status` |
| `reconciliationRuns` | `workspaceId`, period ID, type, version, state, input import IDs, rule versions, engine version, AI/extraction versions, requestedBy, totals, reviewed/published metadata | `by_period_version`, `by_workspace_state`, `by_idempotency` |
| `reconciliationResults` | `workspaceId`, `unitId`, `distributorId`, run ID, result type, product/batch/return references, expected/actual/difference quantities and paise values, precision, confidence, calculation snapshot | `by_run`, `by_unit_type`, `by_distributor_type`, `by_product_run` |
| `recordMatches` | `workspaceId`, run ID, left/right typed record references, method, score, reasons, AI metadata, status, confirmedBy | `by_run_status`, `by_left_record`, `by_right_record` |
| `discrepancies` | `workspaceId`, `unitId`, `distributorId`, run/result references, stable fingerprint, type, severity, amount/quantity impact, explanation facts, first/last seen | `by_workspace_fingerprint`, `by_run`, `by_unit_type`, `by_distributor_type` |
| `reviewItems` | `workspaceId`, `unitId`, `distributorId`, discrepancy fingerprint, status, outcome, priority, assignee, due date, impact, first/last seen, recurrence count, resolution snapshot | `by_workspace_status_priority`, `by_assignee_status`, `by_fingerprint`, `by_unit_status`, `by_distributor_status` |
| `reviewEvents` | `workspaceId`, review item, event type, actor, old/new values, reason, timestamp | `by_item_time`, `by_workspace_time` |
| `comments` | `workspaceId`, review item, author, body, mentions, edited metadata | `by_item_time` |
| `reviewAttachments` | `workspaceId`, review item, file ID, addedBy | `by_item` |

### Operations

| Table | Core fields | Required indexes |
|---|---|---|
| `jobs` | `workspaceId`, optional operational unit/distributor scope, type, state, progress, step, idempotency key, attempts, scheduled function ID, correlation ID, error category/reference, requestedBy | `by_idempotency`, `by_workspace_state`, `by_state_next_attempt` |
| `notifications` | `workspaceId`, user ID, type, channel, grouped key, status/readAt, payload references | `by_user_status_time`, `by_group_key` |
| `notificationPreferences` | `workspaceId`, user ID, configurable channel preferences | `by_workspace_user` |
| `auditEvents` | `workspaceId`, optional operational unit/distributor scope, actor, action, target type/ID, safe before/after summary, reason, correlation ID, timestamp | `by_workspace_time`, `by_target_time`, `by_actor_time` |
| `usageCounters` | `workspaceId`, month, imported rows, documents, AI requests/tokens/cost estimate, runs, users/operational-units snapshot | `by_workspace_month` |
| `idempotencyKeys` | `workspaceId`, key, operation, result reference, state, expiresAt | `by_workspace_key`, `by_expiry` |

### Schema invariants

- Every tenant-owned document has `workspaceId`; every operational-unit-owned record also has `unitId`.
- Inventory, sales, returns, imports, runs, discrepancies, and queue items retain distributor/stockist scope and operational-unit scope where applicable. Aggregates may span only units and partners the user is authorized to access.
- References between tenant-owned documents must have matching `workspaceId`; validate this in mutations.
- Confirmed evidence is never patched in place. Status metadata may change, but source content and calculation snapshots remain immutable.
- Audit events are append-only through internal helpers; ordinary product functions cannot edit/delete them.
- Store patient-identifiable fields nowhere, including logs, analytics, AI metadata, import-row snapshots, and error reports.
- Use stable fingerprints for discrepancies so reruns link to the same Review Queue item.

## 7. Function and authorization conventions

Each feature exposes a small public API and keeps orchestration internal:

- **Queries:** authenticate, resolve active organization, verify membership and operational-unit access, use a tenant-leading index, return only needed fields.
- **Mutations:** repeat the same checks, validate state transitions, commit state and audit event atomically where possible.
- **Actions:** never trust action arguments as authorization. Public actions start from a pre-authorized job; internal actions receive the immutable job ID and scope. External results are validated before an internal mutation stores them.
- **Scheduled functions:** authentication is not propagated by Convex scheduling. Store `workspaceId`, `requestedBy`, scope, and authorization snapshot on the job; use internal-only scheduled functions. Re-check current membership before any delayed action that represents a fresh user decision.
- **File access:** load the file record, verify organization/operational-unit permission, require clean scan state, and stream through the protected endpoint. Do not return reusable raw storage URLs for sensitive files.

Suggested reusable helpers:

- `requireIdentity(ctx)`
- `requireWorkspace(ctx, expectedClerkOrgId?)`
- `requireMembership(ctx, workspaceId)`
- `requireUnitAccess(ctx, workspaceId, unitId)`
- `requireDistributorAccess(ctx, workspaceId, distributorId)`
- `requirePermission(ctx, permission)`
- `requireStepUpEvidence(...)` for sensitive flows initiated through Next.js/Clerk re-verification
- `assertSameWorkspace(...records)`
- `appendAuditEvent(...)`
- `claimIdempotencyKey(...)`
- `transitionState(current, event)`

## 8. Background-job architecture

### Simple v1 design

Do not introduce a separate queue service initially. Use a `jobs` table plus Convex scheduled internal functions:

1. A user mutation validates access, creates or reuses a job by idempotency key, writes `Queued`, and schedules the first internal step.
2. A short mutation claims the step and writes `Processing`.
3. An action performs bounded external or CPU-heavy work.
4. The action calls an internal mutation to validate and persist the result, update progress, write audit/usage metadata, and schedule the next step.
5. Temporary action failures schedule an explicit retry with exponential backoff and jitter. Convex actions are side-effecting and are not automatically retried, so retry policy belongs to PharmaAI.
6. Permanent failures write a safe category, support reference ID, and `Failed`. A user-triggered retry reuses the logical idempotency key while creating a new attempt record or increment.
7. Completion writes `Completed` or `Needs review` and emits grouped notifications.

### Job types

- `scan_file`
- `parse_spreadsheet`
- `validate_import`
- `confirm_import_chunks`
- `extract_document`
- `suggest_column_mapping`
- `normalize_products`
- `suggest_matches`
- `reconcile_returns`
- `reconcile_sales`
- `generate_explanation`
- `send_notification`
- `generate_export`
- `delete_expired_drafts`
- `process_organization_deletion`

### Chunking and idempotency

- Never process 50,000 rows in one mutation.
- Parse once, persist staged rows in bounded chunks, and record a chunk cursor/checkpoint.
- Determine actual chunk sizes from current Convex limits and load tests.
- Use keys such as `workspace:fileChecksum:importType:unit:distributor`, `importId:chunkNumber`, `runId:engineVersion`, and `notificationType:target:eventVersion`.
- Re-running a completed key returns the prior result rather than duplicating rows, queue items, emails, or AI charges.
- A new business version—corrected import, new rule version, or intentional rerun—gets a new logical key.

### Progress and failure behavior

User-visible states are `Queued`, `Processing`, `Needs review`, `Completed`, and `Failed`. Progress is stored as step plus completed/total units, not a fabricated percentage when the total is unknown.

AI failure degrades to manual mapping, manual extraction, or manual matching. It must not block confirmed structured imports or deterministic reconciliation.

## 9. State machines

### Import state machine

```text
Draft
  -> Uploading
  -> Quarantined
  -> Scanning
      -> Rejected (malware/invalid type/prohibited patient data)
      -> Failed (scanner/transport failure; safe retry allowed)
      -> Parsing
          -> Mapping required
          -> Validating
              -> Needs review
                  -> Confirming
                      -> Confirmed
                      -> Failed (confirmation is resumable/idempotent)

Draft -> Deleted (before confirmation only)
Confirmed -> Voided (Owner/Admin, reason required)
Confirmed -> Superseded (Owner/Admin, replacement confirmation required)
```

Entire-import blockers: corrupt, encrypted/password-protected, unsupported or oversized files; unverified organization/operational-unit/distributor scope; prohibited patient data; unknown import type; missing mandatory identity columns; confirmed full duplicate; checksum change during processing; or authorization loss at confirmation.

Rows independently become `Valid`, `Warning`, `Invalid`, or `Excluded`. Partial confirmation requires a summary and explicit confirmation.

### Document extraction state machine

```text
Quarantined -> Scanning -> Extracting -> Needs review -> Confirmed
                         \-> Failed -> Manual entry / Retry
```

No extraction draft affects reconciliation before confirmation. Low-confidence and missing fields are highlighted. The original document remains linked as evidence.

### Reconciliation state machine

```text
Draft -> Queued -> Processing -> Needs review -> Completed -> Locked
                    \-> Failed
Locked -> Reopened (Owner/Admin + reason) -> Queued new run version
```

Only the latest successfully reviewed run becomes the period's current result. Failed or abandoned reruns never replace it. Historical runs never mutate when imports, rules, matchers, or AI models change.

### Review Queue state machine

```text
Open -> Assigned -> In review -> Awaiting external action -> Resolved
Resolved -> Open (reopened manually or recurring discrepancy)
```

Status and outcome are separate. Resolution outcomes include Credit note verified, Additional credit required, Excess credit identified, Partial credit accepted, Valid variance, Corrected source data, Duplicate, Distributor return rejected with reason, Dismissed with reason, and Other.

## 10. Phased implementation

### Phase 1 — Project setup and environments

- Migrate the existing Expo/React Native prototype to Next.js in this same repository. Preserve the landing-page design and content, replace framework-specific code and tooling, and verify the resulting web application before retiring obsolete Expo files.

**User-visible outcome**

- A responsive, accessible PharmaAI shell is available in local, preview/staging, and production environments.
- Public sign-in and privacy placeholders render; protected routes show the application shell with organization/operational-unit placeholders.

**Pages and routes**

- `/`, `/sign-in`, `/privacy`
- Protected shell under `/[orgSlug]/overview`
- Placeholder primary and secondary routes to prove navigation, refresh, bookmarks, and responsive behavior

**Convex tables, functions, and jobs**

- Start with `users`, `organizations`, `memberships`, `operationalUnits`, `distributors`, `auditEvents`, and `jobs` schema shells.
- Add health/config queries without customer data.
- No production background workflow yet; prove one synthetic scheduled job in non-production.

**Clerk roles and checks**

- Configure Google and email one-time-code sign-in; disable passwords.
- Create separate non-production and production Clerk configuration.
- Configure Convex JWT validation using the matching Clerk issuer.
- Protect private route groups and prove unauthenticated denial in both Next.js and Convex.

**External services**

- GitHub, Vercel, Convex, Clerk
- Sentry skeleton and UptimeRobot production placeholder
- shadcn/ui and Tailwind CSS

**Security controls**

- Secrets only in environment stores; checked-in `.env.example` contains names, not values.
- CSP/security-header baseline, safe error boundaries, dependency/secret scanning.
- Separate local, preview/staging, and production credentials and data.
- Maintain web-first `AGENTS.md` instructions in this existing repository.

**Tests and acceptance criteria**

- Formatting, lint, TypeScript, unit-test runner, production build, dependency scan, and secret scan run in CI.
- Pull requests receive Vercel previews using non-production services.
- Manual production promotion and rollback target are documented.
- Sidebar/tablet/mobile navigation meets keyboard and basic accessibility checks.

**Dependencies**

- None.

**Risks/assumptions to validate**

- Pin currently supported package versions only after checking current official docs and compatibility.
- Confirm Node/package-manager standard, Vercel region, domains, and `pharmaai.com` ownership.
- Confirm Clerk plan supports the required organization roles/permissions and production MFA behavior.

### Phase 2 — Clerk authentication and organization onboarding

**User-visible outcome**

- A first Owner signs in with Google or email code, creates a manufacturer organization and first operational unit (for example a division, depot, C&F agent, or region), adds a distributor/stockist, and reaches the Overview without being forced to invite staff.
- Existing users select among their organizations. Invited users accept with the exact verified email.

**Pages and routes**

- `/sign-in`, `/accept-invitation`
- `/onboarding/organization`, `/onboarding/operational-unit`, `/onboarding/distributor`, `/onboarding/demo`
- `/[orgSlug]/team`, `/[orgSlug]/settings/operational-units`, `/[orgSlug]/settings/security`

**Convex tables, functions, and jobs**

- Tables: `users`, `organizations`, `memberships`, `membershipUnits`, `operationalUnits`, `invitations`, `distributors`, `auditEvents`.
- Queries/mutations: sync Clerk identity, create organization mirror, create operational unit, add distributor/stockist, list accessible organizations/units/partners, invite/resend/revoke, accept/sync invitation, change role/scope, remove membership, transfer ownership request.
- Webhook handling may synchronize Clerk events, but every webhook must be signature-verified and idempotent.
- Job: unassign active work after removal/operational-unit-access loss (initially no-op-ready until queue exists).

**Clerk roles and checks**

- Roles: Owner, Administrator, Analyst, Viewer.
- Membership required for private app routes.
- MFA required for Owner/Administrator; optional for Analyst/Viewer.
- Re-verification gates ownership transfer, deletion, administrative access changes, future billing changes, and full export.
- Session inactivity default: 12 hours, subject to Clerk capability validation.

**External services**

- Clerk Organizations, invitations, MFA, re-verification, session management
- Resend only if custom invitation/notification email is required; avoid sending duplicate Clerk and Resend invitations

**Security controls**

- Prevent duplicate application users by unique Clerk user ID and verified-email account-link behavior.
- Validate active Clerk organization against the `[orgSlug]` organization on every server entry.
- Do not rely on a browser-submitted organization ID or a layout-only authorization check.
- Preserve historical actor identity after removal.

**Tests and acceptance criteria**

- Google and email-code sign-in work without passwords.
- A user can belong to multiple organizations with different roles.
- Organization/operational-unit/distributor filtering never leaks cached data.
- Wrong-email invitation acceptance fails; expiry, resend, revoke, and one-time use work.
- Final Owner cannot be removed.
- Removed users lose Convex access immediately; role/operational-unit changes take effect promptly.

**Dependencies**

- Phase 1.

**Risks/assumptions to validate**

- Clerk Organizations' active-organization behavior across multiple browser tabs requires careful token handling; follow current Clerk guidance and test it.
- Validate custom-role production pricing and whether application permissions should be mirrored in Convex to avoid plan coupling.
- Confirm exact invitation ownership between Clerk and PharmaAI.

### Phase 3 — Convex database schema and tenant isolation

**User-visible outcome**

- Users see only their permitted manufacturer organization, operational units, and distributor/stockist data. Owners can manage operational units, channel partners, and initial reconciliation rules. Audit history begins recording security-relevant actions.

**Pages and routes**

- `/[orgSlug]/settings/operational-units`
- `/[orgSlug]/settings/distributors`
- `/[orgSlug]/settings/rules`
- `/[orgSlug]/audit`

**Convex tables, functions, and jobs**

- Implement strict validators and indexes for identity, configuration, products, files/import shells, operational shells, reconciliations, queue, jobs, notifications, usage, and audit.
- Add centralized tenant/permission helpers and append-only audit helper.
- Implement versioned distributor rules and product-master CRUD with aliases.
- Add draft-cleanup and organization-deletion scheduling skeletons; do not enable permanent deletion until Phase 10 review.

**Clerk roles and checks**

- Owner/Admin manage operational units, distributors/stockists, and rules.
- Analyst/Viewer read only permitted configuration needed for their workflows.
- Operational-unit restriction is enforced after Clerk organization authorization; every distributor-scoped query also verifies that the partner belongs to the same workspace and permitted scope.

**External services**

- Convex only.

**Security controls**

- Tenant-leading indexes and same-workspace reference validation.
- No unrestricted `collect()` over tenant-wide high-volume tables.
- Internal functions for jobs and audit; public callers cannot choose arbitrary actors or workspaces.
- Audit permissions, exports, rule versions, and sensitive setting changes.

**Tests and acceptance criteria**

- Automated matrix proves cross-organization, cross-operational-unit, and cross-distributor reads/writes fail for every public function.
- Role matrix tests cover all functions created so far.
- Rule edits create new versions and never change historical versions.
- Product aliases cannot point across organizations.
- Audit records cannot be edited through product APIs.

**Dependencies**

- Phases 1–2.

**Risks/assumptions to validate**

- Index count and query patterns need review against current Convex limits.
- Seven-year audit retention and deletion exceptions need legal review.
- Product identity and distributor-rule defaults need real pilot data.

### Phase 4 — File uploads, validation, and import mapping

**User-visible outcome**

- Authorized users upload CSV/XLSX/PDF/images, see scan and processing progress, map columns, fix row errors, download an error report, and explicitly confirm valid rows.
- Original files remain private evidence. Failed extraction/imports support safe retry or manual entry.

**Pages and routes**

- `/[orgSlug]/imports`, `/imports/new`, `/imports/[importId]`, `/mapping`, `/review`
- `/[orgSlug]/documents`
- Shared upload/job-progress components and stale/connection-lost states

**Convex tables, functions, and jobs**

- Tables: `files`, `imports`, `importMappings`, `importRows`, `documents`, `extractionDrafts`, `jobs`, `idempotencyKeys`, `usageCounters`.
- Functions: authorize upload URL, finalize upload, register checksum, private file download, create mapping, validate mapping, confirm partial import, void/supersede, list status/errors, generate error export.
- Jobs: `scan_file`, `parse_spreadsheet`, `validate_import`, `confirm_import_chunks`, `generate_export`, `delete_expired_drafts`.

**Clerk roles and checks**

- Owner/Admin/Analyst upload and confirm imports.
- Only Owner/Admin void or supersede confirmed imports.
- Analyst may delete only their own draft import; Viewer cannot upload or export.

**External services**

- Convex File Storage
- Cloudmersive private managed malware scanning, after privacy/retention review
- Spreadsheet parsing library selected after security/maintenance review
- OpenAI mapping suggestion is deferred to Phase 8; manual mapping works now

**Security controls**

- Quarantine until MIME/extension/size/checksum validation and malware scan pass.
- Never send files to VirusTotal or a public scanner.
- Detect prohibited patient columns and block the entire import pending a cleaned file.
- Formula-injection-safe CSV exports; zip-bomb and decompression limits; reject encrypted files.
- Authorization-check every file read; do not expose raw bearer storage URLs.
- Immutable confirmed source rows and checksums.

**Tests and acceptance criteria**

- Valid, partial, corrupt, encrypted, oversized, unsupported, duplicate, checksum-changed, prohibited-data, and unauthorized imports behave as specified.
- 50,000-row fixture processes in bounded chunks without duplicate rows on retry.
- Users can leave and return while a job continues.
- Partial import shows counts/warnings and requires explicit confirmation.
- Private file access fails after membership/operational-unit removal.
- Drafts expire after 30 days; confirmed evidence does not.

**Dependencies**

- Phases 1–3.

**Risks/assumptions to validate**

- Set a concrete max file size and processing-time target before coding upload UX.
- Convex protected HTTP delivery currently has a documented response-size constraint; validate the chosen file cap or adopt a reviewed private storage delivery alternative.
- Validate Cloudmersive data handling, deletion, regions, uptime, and file-size support.
- Determine whether server-side spreadsheet parsing fits Convex action limits at target volume; otherwise use a narrowly scoped worker without changing the source of truth.

### Phase 5 — Returns Recon

**User-visible outcome**

- Manufacturer users see distributor/stockist return cases, submitted versus received and approved quantities, expected versus issued credit notes, deadlines, and missing/partial/excess-credit exceptions backed by source records and versioned calculations.
- The Overview shows total return claims, approved return value, credit-note value, outstanding credit obligations, excess-credit exposure, and overdue cases. It must not describe manufacturer liabilities as “recoverable credits.”

**Pages and routes**

- `/[orgSlug]/returns`
- `/[orgSlug]/returns/[returnId]`
- `/[orgSlug]/returns/credit-notes`
- `/[orgSlug]/returns/runs`
- Returns cards/sections on `/[orgSlug]/overview`

**Convex tables, functions, and jobs**

- Tables: `primarySales`, `returnCases`, `returnLines`, `creditNotes`, `creditNoteLines`, `recordMatches`, `reconciliationPeriods`, `reconciliationRuns`, `reconciliationResults`, `discrepancies`.
- Functions: create/manual edit before confirmation, query cases/details, match a distributor claim to the original manufacturer invoice and receipt/approval evidence, select rule version, calculate eligible credit, match manufacturer-issued credit notes, create period/run, review/publish/lock/reopen run, and accept/reject deterministic or suggested matches.
- Jobs: `reconcile_returns`; deterministic candidate matching first, AI suggestions later.

**Clerk roles and checks**

- Owner/Admin/Analyst import, create, run, review matches, and review runs.
- Owner/Admin edit rule versions and reopen locked periods.
- Viewer reads permitted results only.

**External services**

- None required for authoritative calculations.

**Security controls**

- Exact rule/input/version snapshots on each run.
- Confirmation for material match/financial changes.
- No invented values: missing facts yield `Unable to calculate`, `Incomplete data`, or reduced confidence.
- All manual matches and run publication are audited.

**Tests and acceptance criteria**

- Verify accepted quantity × eligible invoice/credit rate, GST, contractual deductions, expiry/batch eligibility, approvals, rejections, partial credits, tolerances, due dates, and fallback start-date assumptions.
- Classifications: correctly credited, partially credited, credit note missing, pending, overdue, excess credit issued, rejected, unable to calculate, and missing information.
- Multiple credit notes can match one return and vice versa without double-counting.
- Locked runs remain immutable; a failed rerun leaves the last current result untouched.
- Representative pilot totals independently match expected results.

**Dependencies**

- Phases 1–4.

**Risks/assumptions to validate**

- Real manufacturer return policies, distributor agreements, schemes, and credit-note practices may expose calculation variants not represented by the initial rule structure.
- Confirm GST, rounding, effective-date, and expected-credit deadline rules with pilot experts.
- Stable discrepancy fingerprint design needs validation against corrected imports and rule-version changes.

### Phase 6 — Sales Recon

**User-visible outcome**

- Users reconcile arbitrary periods by distributor/stockist + product, optionally scope results by operational unit or territory, expand to batches when available, and see quantity/value variances with precision indicators.
- Adjustments use a reviewed, auditable workflow and affect only a new run.

The authoritative quantity equation is:

`expected distributor closing stock = opening stock + primary sales/inward stock + transfers in + retailer returns - secondary sales - returns to manufacturer - expiries/write-offs - transfers out +/- confirmed adjustments`

The result is compared with the distributor-reported closing inventory. A mismatch is an exception for investigation, not proof of theft, fraud, or inaccurate reporting.

**Pages and routes**

- `/[orgSlug]/sales`
- `/[orgSlug]/sales/variances/[resultId]`
- `/[orgSlug]/sales/inventory`
- `/[orgSlug]/sales/runs`
- Sales cards/sections on `/[orgSlug]/overview`

**Convex tables, functions, and jobs**

- Tables: `primarySales`, `secondarySales`, `inventoryMovements`, `inventorySnapshots`, `batches`, `adjustments`, plus reconciliation/result/discrepancy tables.
- Functions: normalize movements, create periods, create reviewed adjustments, calculate expected closing inventory, calculate valuation, review/publish/lock/reopen runs.
- Job: `reconcile_sales` in distributor/product/operational-unit chunks, with batch expansion where available.

**Clerk roles and checks**

- Owner/Admin/Analyst run reconciliation and create confirmed adjustments.
- Owner/Admin reopen locked periods.
- Viewer reads permitted results only.

**External services**

- None required.

**Security controls**

- No inline inventory mutation.
- Adjustment requires type, quantity, optional value, reason, note, actor, and confirmation.
- Use batch-specific manufacturer invoice/transfer value when available, then the configured weighted-average fallback; store the valuation and rule version.
- Exact decimal operations and integer-paise totals.

**Tests and acceptance criteria**

- Test opening stock + primary sales/inward stock + transfers in + retailer returns − secondary sales − returns to manufacturer − expiries/write-offs − transfers out ± adjustments.
- Test quantity/value tolerances, UOM conversions, timing differences, missing batches, missing costs, and reduced precision.
- Batch data is never discarded; product-only fallback is clearly marked.
- Old run remains unchanged after an adjustment; user is prompted to rerun.
- Representative pilot totals independently match expected results.

**Dependencies**

- Phases 1–5; may begin after Phase 4 if shared reconciliation primitives from Phase 5 are extracted first.

**Risks/assumptions to validate**

- Define weighted-average behavior for negative distributor stock, late primary-sales data, corrections, returns, and missing value data.
- Validate UOM conversion rules and product/batch availability in real manufacturer invoices and distributor/stockist reports.
- Arbitrary period boundaries and opening snapshots need clear fallback rules.

### Phase 7 — Unified Review Queue

**User-visible outcome**

- Returns and Sales exceptions appear in one queue with saved launch views, evidence, assignment, due date, priority, comments, attachments, history, and resolution.
- Repeated exceptions update one item; resolved exceptions that reappear reopen as recurring.

**Pages and routes**

- `/[orgSlug]/review`
- `/[orgSlug]/review/[itemId]`
- Saved views: All open, Assigned to me, Unassigned, Critical and High, Overdue credits, Inventory variances, Awaiting external action, Recurring

**Convex tables, functions, and jobs**

- Tables: `reviewItems`, `reviewEvents`, `comments`, `reviewAttachments`, `discrepancies`.
- Functions: upsert by fingerprint, assign, priority override, due date, comment/mention, status transition, resolve, reopen, bulk assignment/priority/due-date/status.
- Reconciliation completion internally links/upserts queue items.
- Job: optional batched queue materialization after large runs.

**Clerk roles and checks**

- Owner/Admin/Analyst manage, resolve, and reopen.
- Viewer reads only.
- Bulk dismissal or material approval requires explicit confirmation and audit; no bulk autonomous financial approval.

**External services**

- None required; notification delivery arrives in Phase 9.

**Security controls**

- All attachments use Phase 4 private-file controls.
- Status transitions and outcomes are validated server-side.
- Reopen/override/dismiss require reason where specified.
- Assignment target must be an active member with operational-unit access.

**Tests and acceptance criteria**

- Complete lifecycle, separate outcome, reopen, recurring behavior, comments, mentions, attachments, and audit history.
- Same fingerprint does not duplicate on retry or rerun.
- Reappearance updates impact and last-seen date while preserving assignment/comments/history.
- Filters survive selection/back navigation; desktop and mobile flows meet the UX contract.
- Bulk actions affect only authorized selected records.

**Dependencies**

- Phases 1–6.

**Risks/assumptions to validate**

- Fingerprints must distinguish genuinely new exceptions from evolving instances.
- Large queue counts and filter combinations require index/load validation.
- Clarify whether cross-operational-unit organization-wide assignees need consolidated views in the pilot.

### Phase 8 — AI-assisted extraction, matching, and explanations

**User-visible outcome**

- Users receive reviewable column mappings, document fields, product aliases, suggested matches, plain-language explanations, and prioritization factors.
- AI outages visibly degrade to manual workflows without blocking deterministic reconciliation.

**Pages and routes**

- AI suggestions embedded in import mapping, extraction draft, return detail, match review, and Review Queue detail.
- Operator-only usage/cost view may live under settings; do not expose internal prompts.

**Convex tables, functions, and jobs**

- Reuse `extractionDrafts`, `recordMatches`, `jobs`, `usageCounters`; add prompt-version registry/config if needed.
- Internal provider interface: `extractDocument`, `suggestMapping`, `normalizeProduct`, `suggestMatches`, `explainDiscrepancy`, `recommendPriority`.
- Jobs: `extract_document`, `suggest_column_mapping`, `normalize_products`, `suggest_matches`, `generate_explanation`.
- Store model, prompt version, latency, token/estimated cost, request state, confidence, confirmation state, and result references—not full prompts/responses by default.

**Clerk roles and checks**

- Same permission as the underlying workflow.
- Only authorized users can confirm mappings, extracted records, aliases, or matches.
- Operator budget controls are not customer role controls.

**External services**

- OpenAI Responses API with structured output and image/file input as supported by the selected current model.
- Select models from official docs during implementation; pin IDs in secure configuration.

**Security controls**

- Data minimization, structured schemas, prompt-injection-resistant extraction instructions, and output validation.
- Never send patient fields, auth tokens, unrelated documents, or cross-tenant context.
- Delete any temporary debug content within 30 days; do not retain full prompts/responses ordinarily.
- No silent model fallback. Retry temporary failures with the configured model; then manual review.
- Monthly pilot alert: 50% of ₹5,000 informational, 80% warning, 100% pause non-essential AI. Essential manual/deterministic/read paths continue.

**Tests and acceptance criteria**

- Golden-set evaluations for Indian invoices, credit notes, statements, and spreadsheet headers.
- Structured output validation rejects malformed or unsupported values.
- Low-confidence fields require review; unconfirmed output never affects reconciliation.
- Prompt injection inside uploaded documents cannot trigger tools, reveal secrets, or bypass confirmation.
- Cost accounting and threshold behavior are reproducible.
- AI-disabled end-to-end test completes manual import and deterministic reconciliation.

**Dependencies**

- Phases 1–7. A small mapping/extraction spike may occur after Phase 4 without making AI a dependency.

**Risks/assumptions to validate**

- Model accuracy, latency, supported file formats, retention controls, and costs must be evaluated with real de-identified samples.
- The ₹ budget requires a maintained exchange-rate policy for provider costs billed in another currency.
- Product matching thresholds and human-review calibration require pilot feedback.

### Phase 9 — Notifications, monitoring, and audit history

**User-visible outcome**

- Users receive grouped, preference-aware in-app notifications and selected emails. Owners can inspect/export audit history. Operators can correlate a user error with jobs, logs, AI metadata, and monitoring.

**Pages and routes**

- `/[orgSlug]/notifications`
- `/[orgSlug]/audit`
- Notification preferences under user/settings
- Safe error UI with support reference IDs

**Convex tables, functions, and jobs**

- Tables: `notifications`, `notificationPreferences`, `auditEvents`, `usageCounters`.
- Functions: list/read notifications, update permitted preferences, grouped emission, audit query/export, security-event recording.
- Jobs: `send_notification`, due-date reminders, overdue checks, grouped delivery, usage budget alerts.
- Cron only for operational reminders/cleanup; v1 does not schedule automatic imports.

**Clerk roles and checks**

- Users see only their notifications.
- Owners/Admins see permitted organization audit history; full export requires Owner re-verification.
- Security notifications and invitations cannot be disabled.

**External services**

- Resend, Sentry, PostHog, UptimeRobot, Convex structured logs, OpenAI usage telemetry

**Security controls**

- Pseudonymous analytics only; exclude names, emails, references, product names, amounts, file contents, and unsafe error text.
- Email templates contain minimal sensitive data and deep-link only after authentication.
- Correlation ID links UI, job, Convex logs, AI metadata, Sentry, and support reference.
- Rate-limit notification generation and group event storms.

**Tests and acceptance criteria**

- Required in-app/email event matrix works; optional settings are honored.
- Removed users receive no organization operational notifications.
- Grouping prevents dozens of messages from one failed run.
- Sentry/PostHog scrubbing tests prove prohibited fields are absent.
- Alerts fire for job backlog/failures, authorization anomalies, stuck imports, reconciliation drop, OpenAI cost/error spikes, production errors, and storage thresholds.
- Audit export is complete, authorized, and formula-injection safe.

**Dependencies**

- Phases 1–8.

**Risks/assumptions to validate**

- Confirm `support@pharmaai.com`, domain/DNS ownership, Resend verification, and support workflow.
- Define alert ownership and response times before pilot launch.
- Uptime checks cover the web endpoint but not all authenticated workflows; add synthetic checks only if privacy-safe.

### Phase 10 — Testing, security review, and production deployment

**User-visible outcome**

- A real pilot manufacturer can use PharmaAI safely with verified calculations, documented support, recoverability, and a controlled release process.

**Pages and routes**

- Finalize empty/loading/error/stale/permission-denied states across every route.
- Finalize privacy, help/support, organization deletion, export, and recovery messaging.

**Convex tables, functions, and jobs**

- Final index/query review and staged schema deployment strategy.
- Backup/export and restore validation.
- Enable controlled 30-day organization deletion workflow only after legal/security review.
- Add cleanup of abandoned drafts and temporary AI debug data.

**Clerk roles and checks**

- Re-run the complete role/operational-unit/distributor/function authorization matrix.
- Verify MFA, session revocation, 12-hour inactivity behavior, invitation expiry, and re-verification in production configuration.

**External services**

- Production Vercel, Convex, Clerk, OpenAI, Resend, Cloudmersive, Sentry, PostHog, UptimeRobot

**Security controls**

- Tenant-boundary review, private-file review, threat model, dependency/secret scans, rate limits, webhook verification, CSP/security headers, incident runbook.
- Validate provider DPAs/retention settings and publish processor list/privacy notice.
- Confirm deletion and seven-year audit retention with legal review; document any retained minimum.

**Tests and acceptance criteria**

- All v1 definition-of-done items below pass.
- No unresolved Critical or High defect.
- Production release records commit, deployment IDs, test results, approval, and rollback target.
- Restore and rollback exercises succeed.
- Pilot users accept representative workflows and independently verified totals.

**Dependencies**

- Phases 1–9.

**Risks/assumptions to validate**

- Production load/performance at design volume.
- Provider outage and quota behavior.
- Legal retention/deletion posture.
- Operational staffing for support, incidents, and manual provisioning.

## 11. Recommended implementation order

Use the numbered phases as release gates, with this practical sequencing inside them:

1. Migrate this existing repository to the web stack, then establish environments, CI, the application shell, and website-only guardrails.
2. Prove Clerk-to-Convex authentication and one tenant-scoped query before building UI breadth.
3. Implement organization/operational-unit authorization helpers and exhaustive isolation tests.
4. Build a **thin vertical slice** using one synthetic manufacturer returns CSV containing a distributor/stockist, original invoice, return claim, approval evidence, and credit note:
   - upload and quarantine;
   - scan and parse;
   - manual map and validate;
   - confirm immutable rows;
   - deterministic expected-credit calculation;
   - create one Review Queue item;
   - resolve it with an audit event.
5. Harden the generic import pipeline and error reporting for all structured input types.
6. Complete Returns Recon because it delivers the primary credit-note correctness and financial-exposure value proposition.
7. Complete Sales Recon using the shared run/result/discrepancy primitives.
8. Finish the unified Review Queue UX and recurrence behavior.
9. Add AI behind manual fallbacks only after deterministic paths and golden datasets exist.
10. Add notification delivery and production observability.
11. Execute security, performance, recovery, accessibility, and pilot acceptance gates.

Do not begin with decorative dashboards or broad AI automation. Overview metrics become trustworthy only after their underlying imports, calculations, and drill-down queries are verified.

## 12. v1 definition-of-done checklist

### Product workflow

- [ ] Owner signs in with Google or email code, creates a manufacturer organization/operational unit, and adds a distributor/stockist.
- [ ] Owner can use demo/sample data without inviting staff first.
- [ ] User uploads, maps, validates, and confirms representative files.
- [ ] PDF/image extraction produces a reviewable draft and requires confirmation.
- [ ] Returns Recon identifies correct, missing, partial, overdue, and excess manufacturer-issued credit notes against distributor returns.
- [ ] Sales Recon compares primary sales, distributor-reported secondary sales, returns, adjustments, and closing inventory to calculate quantity/value variance.
- [ ] Review Queue supports assignment through audited resolution and reopening.
- [ ] Recurring discrepancies reuse and reopen the correct queue item.
- [ ] Overview metrics drill into exactly matching filtered records.

### Calculation correctness

- [ ] Expected-credit calculations cover submitted/received/accepted quantity, original invoice or approved credit basis, eligibility, deductions, GST, tolerances, and deadlines.
- [ ] Inventory equation, UOM conversions, valuation fallback, tolerances, and precision states are tested.
- [ ] Money uses paise/decimal-safe operations; no business calculation uses binary floating point.
- [ ] Rule, import, engine, valuation, prompt, and model versions are traceable.
- [ ] Pilot totals are independently verified against expected results.

### Security and privacy

- [ ] Cross-organization, cross-operational-unit, and cross-distributor access tests pass for every public Convex function.
- [ ] Every role is server-side restricted according to the matrix.
- [ ] Private files require authorization and a clean scan state.
- [ ] Removed users lose access immediately.
- [ ] MFA and sensitive-action re-verification work in production.
- [ ] Patient-data rejection and telemetry/log scrubbing are tested.
- [ ] Webhook signatures, idempotency, rate limits, secrets, CSP, and security headers are reviewed.
- [ ] Privacy notice, processor list, deletion process, and incident instructions are published.

### Import and resilience

- [ ] Valid, partial, invalid, duplicate, prohibited-data, and retry cases pass.
- [ ] Background jobs expose progress and safe support references.
- [ ] Retries do not duplicate rows, records, queue items, emails, or AI charges.
- [ ] Failed AI falls back to manual workflows.
- [ ] Failed reruns never replace the latest successful result.
- [ ] Connection loss preserves drafts and never falsely confirms a mutation.

### Quality and accessibility

- [ ] Unit tests cover calculations, rules, fingerprints, priority, and permissions.
- [ ] Integration tests cover imports, tenant isolation, reconciliation, and queue lifecycle.
- [ ] End-to-end test covers onboarding through audit export.
- [ ] Current Chrome, Edge, Safari, common tablet width, and common mobile-browser width pass.
- [ ] Keyboard navigation, screen-reader labels, focus states, contrast, and WCAG 2.1 AA automated checks pass.
- [ ] No unresolved Critical or High defect remains.

### Operations and release

- [ ] Local, preview/staging, and production services and secrets are isolated.
- [ ] CI passes formatting, lint, TypeScript, unit/integration tests, production build, dependency scan, and secret scan.
- [ ] Production promotion is manual and has an identified rollback target.
- [ ] Sentry, PostHog, logs, OpenAI usage, UptimeRobot, and required alerts are verified.
- [ ] Backup/restore and rollback exercises succeed.
- [ ] Cloudmersive and other provider privacy/retention reviews are complete.
- [ ] Support ownership, incident contacts, and pilot provisioning are documented.
- [ ] Representative manufacturer pilot acceptance is signed off.

## 13. Validation register before coding each affected area

The following decisions deliberately remain validation gates rather than guesses:

| Item | Required validation | Latest responsible phase |
|---|---|---|
| Package versions | Check current official Next.js, Convex, Clerk, OpenAI, Tailwind, and shadcn/ui docs; pin compatible versions | Phase 1 |
| Clerk plan/capabilities | Custom roles, permissions, MFA enforcement, inactivity timeout, account linking, re-verification | Phase 2 |
| File limit | Choose max bytes/pages and ensure protected delivery, scanning, parsing, and AI limits agree | Phase 4 |
| Processing SLOs | Define expected times for 50k rows, 500 documents/month, and reconciliation | Phase 4 |
| Cloudmersive | Privacy, retention, region, deletion, DPA, limits, and outage behavior | Phase 4 |
| Convex workload limits | Function/action duration, memory, mutation size, indexes, scheduled jobs, HTTP response size | Phase 4 |
| Return rules | Validate with real manufacturer return policies, distributor agreements, and de-identified samples | Phase 5 |
| Weighted average | Specify negative distributor stock, corrections, returns, missing values, and late primary/secondary-sales data behavior | Phase 6 |
| Discrepancy fingerprints | Validate stability across reruns, corrected imports, and rule changes | Phase 7 |
| OpenAI selection | Current model IDs, structured output, image/PDF support, data controls, latency, cost, and golden-set accuracy | Phase 8 |
| AI currency conversion | Define exchange-rate source/timing for ₹5,000 alerts | Phase 8 |
| Retention/deletion | Legal review of seven-year audit retention versus deletion obligations | Phase 10 |
| Domains/support | Confirm domain, support mailbox, Resend DNS, sender reputation, and trademark/brand availability | Phase 9 |

## 14. Current official references used for this plan

- [Next.js App Router documentation](https://nextjs.org/docs/app/getting-started)
- [Next.js route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [Clerk Organizations overview](https://clerk.com/docs/guides/organizations/overview)
- [Clerk roles and permissions](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions)
- [Clerk authorization checks](https://clerk.com/docs/nextjs/guides/secure/authorization-checks)
- [Convex with Clerk](https://docs.convex.dev/auth/clerk)
- [Convex schemas](https://docs.convex.dev/database/schemas)
- [Convex file storage security model](https://docs.convex.dev/file-storage/overview)
- [Convex scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions)
- [Convex cron jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [OpenAI image and vision input](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)

Re-check these sources at implementation time. Package APIs, service limits, model names, pricing, and provider capabilities are time-sensitive.
