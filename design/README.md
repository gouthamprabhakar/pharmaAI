# PharmaAI design references

Status: the complete 12-view MVP reference set is approved for implementation. Superseded legacy references have been removed and remain recoverable through Git history.

## Source of truth

- `../MVP_SPEC.md` defines the approved product, workflow, evidence, AI, and screen requirements.
- `../PLAN.md` defines the implementation and cleanup sequence.
- This folder contains visual references. A legacy image is not permission to reintroduce an obsolete destination.

## Approved reference set

The revised product uses 12 meaningful views:

1. Landing.
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

Temporary processing, mapping, validation, extraction, notifications, run history, and adjustment experiences belong inside those views.

## Visual foundation to preserve

- 1440 x 1024 desktop reference viewport unless a replacement explicitly states otherwise.
- PharmaAI teal, navy, white, muted green, amber, red, and blue status language.
- Compact enterprise density with readable financial amounts.
- Persistent desktop navigation and a responsive browser layout.
- Quiet borders and backgrounds; status color is reserved for meaning.
- Synthetic manufacturer, distributor, product, document, and financial data.
- Visible fictional-demo disclosure until connected functionality exists.

## Global redesign rules

- Primary navigation: Overview, Returns & Credits, Sales & Stock, Review Queue.
- Supporting navigation: Data Intake, Reports, Administration.
- Notifications move to a header panel.
- Audit history moves under Administration.
- The signed-in manufacturer is fixed workspace context, not an ordinary organization filter.
- Operational Unit and Distributor filters offer `All permitted` when access allows it.
- AI appears inside case, variance, queue, and management-summary contexts with citations, confidence, and human controls.
- Deterministic calculations and source evidence remain visually distinct from AI output.
- Buttons must represent a real UI transition or explicitly disclosed demo behavior.
- Financial amounts and quantities must not truncate or wrap ambiguously.
- Desktop, 1280, 1024, tablet, and mobile browser layouts must be verified.

## Approved files

1. `landing-mvp.png`
2. `sign-in-invitation-mvp.png`
3. `guided-setup-mvp.png`
4. `overview-dashboard-mvp.png`
5. `data-intake-mvp.png`
6. `returns-credits-mvp.png`
7. `return-case-workspace-mvp.png`
8. `sales-stock-mvp.png`
9. `variance-workspace-mvp.png`
10. `review-queue-mvp.png`
11. `reports-mvp.png`
12. `administration-mvp.png`

Editable design-only HTML sources are in `prototypes/`. They make the product decisions inspectable without becoming application runtime code.

### Overview

Use `overview-dashboard.png` as the visual foundation, then:

- Replace the eleven-item sidebar with the approved primary/supporting navigation.
- Show the manufacturer as fixed context.
- Reduce the large metric grid to six decision-oriented summaries:
  - Returns awaiting eligibility review.
  - Approved returns awaiting credit.
  - Overdue credit value.
  - Unexplained sales/stock variance.
  - Overdue distributor reports.
  - Open high-priority review items.
- Add an evidence-linked `AI management brief` describing the most important current exceptions.
- Replace `Reconciliation runs` with `Distributor reporting compliance`.
- Keep recent activity/import evidence available without making technical runs a normal workflow.
- Give Returns & Credits and Sales & Stock equal, clearly separated summaries.

### Return Case Workspace

Use `return-case-detail.png` as the visual foundation, then:

- Display `PharmaAI Case ID` and `Distributor Return Reference` separately.
- Present evidence chronologically: original invoice, distributor request, manufacturer/C&F receipt and photographs, eligibility, approval, credit note.
- Preserve separate submitted, received, eligible, approved, and credited quantities.
- Keep quantity and financial amounts in separate columns.
- Add eligibility status, eligibility reason, applied policy, and policy version.
- Replace the generic credit-match suggestion with an `AI evidence assistant` containing citations, confidence, uncertainty, and correction.
- Add an explicit human decision section: approve, reject, or request clarification.
- Keep the finance action inside the case after approval: record credit, import/match credit, or follow up on an outstanding amount.
- Preserve comments, ownership, due date, and audit events without treating them as separate destinations.

### Variance Workspace

Use `inventory-variance-detail.png` as the visual foundation, then:

- Keep the deterministic stock equation as the primary calculation.
- Show reporting period, compliance state, distributor, product, batch, and responsible owner.
- Replace the generic evidence-only paragraph with an `AI variance explanation` containing cited movements, confidence, alternative explanations, and missing evidence.
- Show recurrence for the same distributor/product/batch.
- Provide clear human actions: request corrected report, accept evidenced timing difference, create adjustment, escalate, or carry forward.
- Require reason and evidence before adjustment or resolution.
- Keep original evidence immutable and visually distinct from a reviewed adjustment.
- Remove reconciliation runs from the normal workflow.

## Consolidated route model

- `/` — Landing
- `/sign-in` and `/workspace-invitation` — Sign in and invitation
- `/setup` — Guided setup
- `/overview` — Overview
- `/data` — Data Intake
- `/returns` and `/returns/PAI-RET-01048` — Returns & Credits and case workspace
- `/sales` and `/sales/SV-2026-0184` — Sales & Stock and variance workspace
- `/review-queue` — Queue with integrated detail
- `/reports` — Reports
- `/administration` — Administration

Former processing, mapping, validation, extraction, run-history, notification, adjustment, and settings pages are no longer primary destinations. Their necessary behavior is represented inside the approved views or reserved for later implementation phases.

## Authentication support states — 30 October 2026

`/account/security` hosts the signed-in user's Clerk account-security controls and `/verify` resumes an OAuth second-factor challenge. These support authentication; they are not added primary navigation destinations or replacements for the approved twelve views. The normal manufacturer identity remains fixed. If the session has no active workspace, show only the user's existing Clerk memberships for explicit selection.

The user approved optional MFA for the development demo only. Show a development notice when that server-controlled exception applies. Production security and deferred implementation work are tracked in `../todo.md`; no new screenshot claims that live MFA, business uploads or reconciliation are complete.
