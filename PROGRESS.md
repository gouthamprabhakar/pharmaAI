# Backend implementation progress

Started: 30 October 2026. Authority: MVP_SPEC.md > PLAN.md > AGENTS.md > design references.

## Phase gates

| Phase | Status | Exit evidence required |
|---|---|---|
| 3 Authentication and authorization | Development exit verified; release gates remain open | Server role/scope, signed-event and authenticated browser tests pass. MFA remains optional only in explicit development. Activate real Clerk webhooks and verify external delivery before client use |
| 4 Data foundation | Next after Phase 3 checkpoint | Strict configuration, exact arithmetic, append-only audit, idempotency, fictional seed guard |
| 5 Intake | Pending Phase 4 | Protected files, real scan, parse, row validation, confirmation, correction, retry and duplicate tests |
| 6 Returns and credits | Pending Phase 5 | Receipt, versioned eligibility, authorized decisions, credit allocation and closure tests |
| 7 Sales and stock | Pending Phase 6 | Complete stock equation, independent shipments, tolerances, corrected reports, adjustment and resolution tests |
| 8 Queue, reports and AI | Pending Phase 7 | Scope, routing, reopening, traced reports, exports and validated cited AI with fallback |
| 9 Readiness and cleanup | Pending Phase 8 | Monitoring, browser/accessibility/performance/recovery checks and approved production build |

## Phase 3 plan and acceptance tests (before implementation)

1. Preserve the existing working tree in a checkpoint commit without credentials.
2. Verify existing Clerk/Convex development linkage without creating replacement projects.
3. Add fail-closed resource-level page protection and centralized Convex authorization. Identity comes from Clerk; roles and scopes come from current application membership, never caller input.
4. Add membership, unit, distributor, MFA, step-up, revocation, final-owner and invitation contracts. Deny missing/ambiguous scope and cross-organization references.
5. Test all roles against both allowed and denied capabilities; missing identity, inactive identity, inactive organization, revoked membership/unit/distributor, stale verification, invalid tokens and cross-tenant IDs.
6. Run lint, typecheck, unit/integration, existing browser checks and production build. Preserve failing tests and diagnose root causes. Do not advance the phase while an exit criterion fails.

### MFA and membership follow-up plan

The user requested MFA enrollment and workspace membership on 30 October 2026. Reuse the existing Clerk/Convex projects. Enable authenticator and backup-code options without requiring every role to enroll. Create one fictional development workspace only if none exists, reuse the user's verified account and protect account-security setup by sign-in rather than requiring prior company access. Provide an explicit selection of current Clerk membership without adding a manufacturer dropdown to normal screens. Bootstrap matching Convex membership through an internal, development-only, idempotent function with an audit event. Test production denial, retry behavior, scope and final owner protection before claiming provisioning complete. Account-holder enrollment and live signed organization/MFA verification remain mandatory; never store recovery codes or MFA seeds in files, logs, screenshots or chat.

OAuth callbacks must route second-factor challenges to a working Clerk verification component, preserving the existing Google-only entry page. Test that the verification page is reachable without exposing company records; live challenge completion still requires the account holder.

Official Convex guidance reviewed during setup states that `fva` is removed from `getUserIdentity()`. The earlier direct-claim implementation fails closed but cannot authorize a real native-integration MFA session. A verification bridge was drafted, but it was not completed or deployed: Convex rejected its draft module naming. The user then deferred MFA, so that unfinished draft and its direct SDK dependency were removed. Track the corrected native-integration MFA/reverification design and tests in `todo.md`; do not claim a connected MFA check from mocked identities.

The user explicitly approved MFA being optional for development only on 30 October 2026. Before implementing the exception: require an explicit opt-in flag, an explicit development environment, and a Clerk development issuer together. Google identity and current organization/role/unit/distributor authorization must still be enforced. Tests must prove each missing condition and every production combination fails closed; development sensitive actions must still enforce role/scope, reason, audit and final-owner protections. Real client data and production use remain blocked until the deferred security gates pass.

## Baseline findings

- Clerk and Convex packages and provider wiring exist; live business records and file processing do not.
- The existing viewer query returns only identity; no membership authorization helper exists.
- Existing browser tests still assume the earlier synthetic demonstration. Their expectations must be reconciled with protected routes without weakening security or deleting coverage.
- Existing source hard-codes a real prospect as manufacturer context, contrary to the current specification. Replace runtime identity with authorized organization data.
- Prior production checks reported an internal Next.js bundler failure. Reproduce before claiming build readiness.

## Blocked

1. **Clerk Organizations — resolved:** the user explicitly approved enablement for the existing development app on 30 October 2026. The change was previewed, applied and read back. Final configuration: Organizations enabled, forced organization selection off, automatic organization creation off. Clerk initially turned forced selection on by default; a previewed correction restored the approved off setting. No invitations were sent and no replacement app was created. This resolves the earlier automatic-approval rejection, not the remaining MFA/membership gates.
2. **MFA — deferred by user:** authenticator and backup-code options are now enabled. The account holder has not enrolled. The user explicitly approved optional MFA for development only; all three server conditions must match. Production remains fail-closed. Convex excludes `fva` from its identity, so the deferred native MFA/reverification integration must be corrected before real client use; mocked signed claims are not live evidence.
3. **Provider event activation:** the signed receiver and removal/role/session handling are implemented and cryptographically tested. The real Clerk endpoint/signing-secret registration is not configured; the receiver deliberately returns 503 without its signing secret and instance ID. App revocation is immediate; no instantaneous external Clerk revocation is claimed, because provider webhooks are asynchronous. Delivery uses the real SDK and protected development environment credentials, but no real-person email was sent or inbox delivery claimed during testing. Authenticated development browser coverage now passes. Deferred activation and native MFA work remain in `todo.md`.

At the initial checkpoint, Phase 4 was held pending Phase 3's tests and development setup. The later continuation below verifies its stated development exit (server-side role and scope tests) and adds authenticated browser evidence. The user-approved MFA exception and the unconfigured external webhook remain release gates. Under the user's blocker instructions, independent data-foundation work can continue after the passing development checkpoint; production readiness and the full MVP are not declared complete.

## Verification log

Final Phase 3 check results, 30 October 2026:

| Command | Result and output |
|---|---|
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm run test:unit` | PASS, `Tests 30 passed (30)` |
| `npm run test:integration` | PASS, `Tests 23 passed (23)` |
| `npm run build` | PASS, `Compiled successfully`, TypeScript completed, `Generating static pages ... (6/6)`, exit 0 |
| `npm run test:e2e` | PASS, `31 passed (37.1s)`, exit 0 |
| `npx convex codegen --typecheck enable` | PASS, official generated bindings and backend typecheck |
| `npx convex dev --tail-logs disable` | Connected to the existing development deployment; `Convex functions ready!` |
| `git diff --check` | Run before checkpoint commit |

Unit cases cover all roles, allowed/denied capabilities, export grants, invalid verification ages, MFA freshness, and current/legacy/conflicting signed organization claims. Integration cases exercise public Convex registrations against the official isolated Convex test harness, including missing identity, unknown subject, cross-tenant IDs, unit/distributor restrictions, deactivation, scope removal, role downgrade, final-owner protection, signed MFA, step-up, current session claims, pending sessions, invitation addressee/expiry/revocation/replay, idempotency conflicts and audit actor/reason/before/after.

Browser checks include all seven anonymous workspace boundaries, invitation-only Google sign-in, landing at ten widths (320–1920 pixels), keyboard/modal behavior, server rendering without JavaScript, and automated WCAG checks of the public/sign-in boundaries. They do **not** prove authenticated workspace layouts, MFA completion, invitation delivery or business workflows. No test is skipped. The older assertions for removed email-code and anonymous demo access were updated to the approved Google-only/denied-anonymous contract, with stronger explicit no-record/no-action assertions and accurate test names. They were not replaced by an authentication bypass.

### Failures diagnosed and corrected

- Turbopack's PostCSS worker could not bind an internal port in this execution environment. The supported Webpack production builder passes. The old generated `.next` cache was moved to `/private/tmp/pharmaai-next-before-backend-20261030` (recoverable); no source/design file was deleted.
- Webpack initially failed inside its generated hashing cache. A clean generated cache fixed it; no application rule or test was disabled.
- Playwright initially hit a Clerk localhost/127.0.0.1 origin mismatch. Server hostname/base URL now consistently use localhost.
- Playwright attempted to load the new Vitest files; `testMatch: **/*.spec.ts` now selects the browser specs, while Vitest explicitly selects the unit/integration `*.test.ts` files.
- Two pre-existing browser assertions described the obsolete email-code and unprotected synthetic-workspace UX. Their assertions now test the approved auth contract. All original browser test cases remain represented; there are 31 passing browser cases in the final run.

### Checkpoints and decisions

- Existing work preserved in baseline commit `e104b21` before backend implementation; secrets excluded.
- `BACKEND_SCREEN_CONTRACT.md` maps all twelve reviewed screenshots to data, actions and server authorization needs. Future operations are explicitly planned, not represented as working.
- Runtime manufacturer identity is read from authorized organization membership; the real prospect is no longer hard-coded into workspace context.
- `AUTHORIZATION.md` documents the implemented interfaces and live-provider limitations.
- Existing untracked workbook builders, outputs and previous artifacts are preserved. No phase-9 cleanup was performed early.
- See `IMPLEMENTATION_REPORT.md` for the ten-item DoD assessment and remaining PLAN section 25 risks.
- Follow-up: development Organizations enablement is verified after explicit approval. This provider-only change does not complete the phase; MFA enrollment, real organization membership and provider synchronization still require verification. Existing passing code checks are unchanged; no new full-workflow claim is made.

## Development membership and deferred-work checkpoint — 30 October 2026

- Created the fictional PharmaAI Pilot Clerk workspace after verifying none existed. Verified the existing account's `org:admin` membership through Clerk, then provisioned the corresponding Convex owner membership via an internal development-only function. First run returned `created: true`; retry returned `created: false` with the same IDs. One audit event is created; revoked membership is never reactivated.
- Enabled authenticator and backup-code options. The user then deferred enrollment and explicitly approved MFA being optional for development only. Applied and read back `PHARMAAI_DEVELOPMENT_MFA_OPTIONAL=true` on the existing **development** deployment, which is marked `PHARMAAI_ENVIRONMENT=development` and uses the linked Clerk development issuer. No production setting was changed, and no invitation was sent.
- `todo.md` centralizes deferred security, authenticated QA, production readiness, existing unimplemented MVP phases and beyond-v1 features. The specification, plan, agent instructions, authorization contract, README and design notes link or describe this decision. This does not declare a phase exit or DoD passed.
- Added signed-in account security, OAuth second-factor continuation and explicit selection of an existing membership. The normal workspace identity remains fixed; no primary business view was redesigned. Live enrollment and signed-in browser coverage remain deferred.
- Removed the abandoned verification-bridge draft and its newly added direct SDK dependency after the user deferred that work. No unrelated source/design assets, existing workbook builders, outputs or artifacts were removed. The final schema has no draft session-verification table.

Final rerun after the development exception: `npm run lint` PASS (exit 0); `npm run typecheck` PASS (exit 0); `npm run test:unit` **40 passed**; `npm run test:integration` **27 passed**; `npm run build` PASS (compiled, TypeScript and 6/6 static pages, exit 0); `npm run test:e2e` **33 passed (41.4s)**; official `npx convex codegen --typecheck enable` PASS. `git diff --check` PASS before checkpoint.

New tests cover production/missing-setting/issuer denial, development-only MFA optional access, unchanged anonymous/tenant/final-owner/revocation protections, idempotent audited workspace setup, production bootstrap denial, no membership reactivation, anonymous account-security denial and a verification route that exposes no company records. These tests do not substitute for the deferred live MFA or business-workflow checks.

## Phase 3 continuation plan — 30 October 2026

The user requested continued implementation. Keep the explicit development-only MFA exception and leave enrollment/native MFA proof in `todo.md`.

1. Add a signed Clerk webhook receiver and append-only event deduplication. Apply only verified membership/user/organization removals and role downgrades; do not turn a provider membership into an application privilege grant. Keep historical evidence and identities. Reject invalid/missing signatures and missing configuration, and handle retries and out-of-order events without duplicate audits or reactivation.
2. Deny revoked provider sessions on every protected request. Membership/user/unit/distributor permissions continue to be checked from current database records, independently of UI visibility.
3. Connect invitation delivery behind authorized server interfaces, with stable operation keys, explicit delivery states, scoped acceptance and revocation. Test the provider boundary without sending messages to real people. If endpoint/signing configuration needs a dashboard action, record it as blocked and keep the receiver fail-closed.
4. Add authenticated Playwright coverage using the official development-only Clerk testing helpers and fictional test accounts. Cover own-workspace access, organization selection, distributor denial, sign-out, revocation and no accidental access to a second tenant. Test helpers must never become a production authentication bypass or be described as a Google OAuth/MFA test.
5. Run all required checks, update the screen/backend contracts and deferred list with exact evidence, then commit. Advance only when the applicable phase exit is met; never relabel an unconfigured provider connection as verified.

### Phase 3 continuation results

- Added `/clerk/webhook` on the existing Convex HTTP endpoint. It uses Clerk's official verifier, checks the linked instance, bounds payload size and persists only minimal event IDs/types/subjects. Duplicate events do not duplicate audits; removals retain users, membership history and company records; stale/create/promote events never reactivate access. Revoked sessions are checked by protected access and identity functions.
- Connected invitation preparation, scoped team listing, requested delivery, revocation, acceptance and recovery. A durable single-attempt flag prevents repeated outbound creation. Unknown/interrupted attempts are reconciled by the stable application invitation ID instead of blindly resending. Jobs recheck current actor/grant scope, and revocation races cancel the returned provider invitation. Provider acknowledgement is distinguished from inbox delivery.
- Wired the existing Administration > Team & access action to its dialog, with real member/invitation lists and explicit delivery statuses. Workspace-access states can accept an intended invitation. The twelve primary views are preserved. Decorative navigation initials were marked hidden from assistive technology after the browser test exposed incorrect accessible link names. Visual review corrected the native dialog centering; keyboard focus, WCAG checks and 390px fit pass.
- Existing Clerk development session claims now include signed email and verification fields. Real invitation-acceptance browser coverage proves they reach Convex. Corrected a prior provider configuration gap: read-back verifies Google enabled, email sign-in disabled, email sign-in strategies empty, and email retained for invitations. No production instance or auth method was added.
- Official Clerk development testing helpers provision isolated fictional accounts and a test workspace. Tests use genuine sessions and server verification; they do not claim to test Google OAuth or MFA. Only resources created and marked by the run are removed from Clerk, and Convex historical records are deactivated/preserved. No real-person invitation was sent. Session traces/auth-state files are not retained.
- The stated Phase 3 development exit is met. Real webhook activation, externally observed delivery and the explicitly deferred native MFA/reverification remain release gates; the full MVP remains incomplete.

Passing check evidence: lint and typecheck exit 0; **40 unit tests**; **49 integration tests**; production build compiled and generated **6/6** static pages; full browser suite **40 passed (1.6m)**. A final focused rerun after the provider Google-only correction is recorded below. The official Convex generator/typecheck and `git diff --check` pass. Earlier test failures (Clerk initialization timing, trace setting placement, provider optional-status typing and decorative nav link names) were fixed at their causes; no checks were skipped or weakened.

Post-provider-correction check: `npx playwright test tests/authenticated.spec.ts tests/auth-boundaries.spec.ts` — **17 passed (1.1m)**, exit 0. This confirms genuine development sessions and the application boundaries after disabling provider email sign-in; it does not claim Google OAuth or MFA coverage.

## Phase 4 plan and acceptance tests — before implementation

1. Add reviewed `decimal.js` exact helpers. Accept bounded decimal strings for quantities/rates, integer safe paise for money, and explicit rounding. Test fractional arithmetic, negative/invalid/overflow inputs, tax/deduction rounding, tolerance boundaries and all stock movements. Never use binary floating point for quantity/rate calculations.
2. Add strict configuration validators and tenant-leading indexes for master data, aliases, batches, controlled template versions, effective-dated policies/tolerances, monthly obligations and resumable setup. Preserve historical configuration versions and audits. Correct the unused baseline business quantity/status schema before real imports begin.
3. Implement authorized configuration queries/mutations with current membership and both existing/replacement scope checks. Stable keys deduplicate retries and reject changed payloads. Reject cross-tenant references, duplicate codes/aliases, invalid dates/time zones, policy overlaps and unauthorized scope expansion. Immutable rule versions are selected explicitly by business date; no return policy/tax default is inferred.
4. Wire the existing Administration actions and guided setup without changing the approved primary navigation. Persist configured fields and progress, expose pending setup requirements, and keep unconnected intake/reconciliation/AI labelled. Optional fictional setup is explicit and development-only; never auto-fill the user's empty workspace.
5. Acceptance evidence: isolated integration tests for current/removed roles, units/distributors, history/audit, retry/conflict, strict references, version selection and production seed denial; genuine-session Playwright for persistent manufacturer setup, reload and denied distributor configuration. Verify keyboard/accessibility/mobile fit for new supporting dialogs. Run all phase checks and record exact outputs before committing or advancing.

External webhook activation, native MFA and observed external delivery remain release gates in `todo.md`; this phase does not change their status.

### User change to verification approach

The user requested: “these tests are taking too much usage. Just build everything and I'll manually test it.” Stop repeated unit/integration/browser runs, preserve all existing tests, and continue implementation with lightweight type/build checks. Record automated coverage as unverified after subsequent changes; never label the interrupted browser run a pass. Supply a manual acceptance checklist and keep unmet release gates explicit. This instruction supersedes the earlier repeat-all-tests loop; it does not permit bypassing authorization, fake connected operations, or claiming the Definition of Done has passed.

Before this change: Phase 4 unit checks reported **63 passed** and integration checks **64 passed**. Later workflow-field additions and subsequent implementation are not covered by those results. The current full browser run was interrupted at the user's request. Future automated business-workflow verification is deferred to explicit user request.

Interrupted browser output: **39 passed, 1 interrupted, 2 did not run; exit 130**. This is not a passing suite. The connected setup case was stopped while selecting the unit type. It was not presented as verified.

### Phase 4 implementation checkpoint

Implemented exact decimal/money helpers, stable operation fingerprints/keys, current configuration with append-only history/audits, strict policy/template/tolerance/deadline versions, units/products/distributors/aliases/batches, resumable setup, and a guarded optional fictional seed operation. Existing Administration controls and the guided setup now save configuration. Google/membership authorization remains enforced. The seed setting is absent by default and no sample data was added to the user's workspace.

Decisions: policy-date basis is immutable within a policy code; revision dates advance rather than rewriting earlier versions; quantity units and master codes cannot silently change; monthly due days are limited to 1–28 initially; tax/deduction rates and rounding require explicit manufacturer input. No policy/tax default is assumed. Read endpoints cap configuration at 2,000 rows per table with an explicit limit error rather than silently truncating. Larger configuration pagination is a remaining limitation.

Phase 4 is implemented but manual acceptance remains pending under the user's revised verification instruction. Continue independent implementation; do not claim the original all-checks-green phase gate or full MVP Definition of Done is satisfied.

Lightweight checkpoint after workflow-field additions: `npm run typecheck` exit 0; `npm run build` compiled, TypeScript completed and generated 6/6 static pages, exit 0; `git diff --check` exit 0. Full automated suites were not rerun, as requested.

## Phase 5 implementation plan — before coding

Implement scoped upload intents, immutable evidence, security-scan status, resumable jobs, bounded CSV/XLSX parsing, prohibited-data rejection, controlled template validation, row corrections/versioning and explicit confirmation. Stable file/row keys prevent repeated normalization. Connect existing intake tabs, controlled downloads, validation results, retry and history. Keep scanner configuration fail-closed and log a missing provider as blocked; do not mark an unscanned file clean. Manual acceptance must exercise file, row, duplicate, correction, permission-loss and interrupted-upload cases. Preserve existing automated tests without running full suites under the user's revised instruction. Type/build checks remain required for implementation errors.

### Phase 5 provider blocker

Update on 30 October 2026: the user removed automated malware/DLP scanning from the MVP as overengineering. The adapter, scan records, quarantine dependency and provider environment settings were removed. Intake now proceeds through authorization, metadata, template and bounded structural validation with a required no-patient-data declaration. Reconsideration is recorded in `todo.md`. AI provider credentials/model remain absent locally; connected AI must remain explicitly unavailable until configured.

Spreadsheet parsing uses ExcelJS 4.4.0, yauzl 3.4.0 and exact numeric XML tokens. A dependency audit exposed an old transitive uuid advisory; inspected ExcelJS usage is the compatible v4 API. An ExcelJS-specific override to patched CommonJS-compatible uuid 11.1.1 removes the warning. Installation audit then reported zero vulnerabilities. Limits are 5 MiB compressed, 20 MiB decompressed, 2,000 archive entries and 1,000 data records; formulas/macros/embedded/external-link workbooks are not accepted.

### Phase 5 implementation checkpoint

Added authorized upload intents and checksum deduplication, immutable file/check/record versions, resumable processing jobs, exact CSV/XLSX parsing, controlled downloads, source-scoped legacy mapping versions, record validation/correction/exclusion, explicit warning/partial acceptance and bounded confirmation. Configuration/permission changes are rechecked at each job step. Unchanged clean scan results can be reused without a new outbound scan. Failed correction attempts do not replace accepted evidence. Download requests reauthorize each request through Next.js and Convex rather than exposing storage URLs to the browser.

The existing Data Intake tabs now use these functions instead of simulated uploads/history/downloads. `MANUAL_TESTING.md` records setup/intake acceptance steps. No files were uploaded on the user's behalf, no scanner was connected, and no intake workflow is certified as passed. Node-only helper directives and the query-reader/writer type mismatch were corrected during compilation. Full suites remain unrun by user request.

Lightweight evidence: official Convex generator/typecheck PASS; Next.js Webpack build compiled, TypeScript completed and generated 6/6 static pages including the evidence route; final `npm run typecheck` exit 0 after the last scope/validation changes; `npx convex dev --once --tail-logs disable` reports **Convex functions ready** on the existing development deployment; `git diff --check` exit 0. No new full-suite or manual acceptance pass is claimed.

## Phase 6 implementation plan — before coding

Project accepted return evidence into stable cases/lines; preserve each source and calculation version. Add manufacturer receipt records with separate submitted/received/eligible/approved/credited quantities and protected photo evidence. Evaluate invoice/product/batch/date/quantity and the explicitly applicable policy with exact arithmetic; missing/ambiguous evidence remains unresolved. Require an authorized human decision and reason, then send approved amounts to the Finance worklist. Record individual issued notes or project confirmed credit imports, match exact/short/excess amounts, preserve credit allocations, overdue and closure. AI extraction/matching stays advisory, with explicit unavailable state and manual confirmation until a provider is configured. Add manual return/credit acceptance steps; continue compilation checks without full test runs per the user's instruction.

## Phase 7 implementation plan — before coding

Project accepted monthly reports into typed stock records. Compare independent manufacturer receipts with distributor-declared movements; require a human-confirmed opening baseline or a contiguous reconciled prior closing. Preserve batch precision, source versions, tolerance versions and exact calculations. Missing/ambiguous inputs remain incomplete, never an invented zero. Quantity variance can be calculated without valuation; financial exposure remains unknown until a reviewer confirms an evidenced valuation rate. Add correction, evidenced adjustment, escalation, resolution and carry-forward decisions without editing original reports. Recalculate stable variance fingerprints, preserve historical runs and reopen changed issues. Track monthly obligations and waivers separately from report processing. Acceptance remains manual: matching, short stock, missing input, first opening, prior-period carry, source correction, duplicate retry, permission removal and human-resolution cases must be checked. No full test suites under the revised instruction.

### Phases 6–7 implementation checkpoint (manual acceptance pending)

Added stable return cases and typed manufacturer sales, immutable receipt/decision/calculation/credit records, exact eligibility and credit matching, Finance worklist and confirmation of actual issued note totals. Corrections remain versions; existing confirmed credit evidence remains effective while its amendment awaits confirmation. Receipt images/PDFs require authorized scope, supported type/size and a no-patient-data declaration. Optional distributor images are supporting evidence, never manufacturer receipt confirmation.

Added typed monthly stock reports, independent manufacturer-receipt comparison, explicit first opening baseline, contiguous reconciled prior closing, full movement equation, effective tolerances, quantity/value separation, immutable adjustments and human actions. Missing manufacturer period evidence/opening/tolerance remains incomplete; no valuation price is inferred. Monthly reporting compliance and reasoned waivers are separate from intake acceptance. Global filters and case/variance links now query saved records. AI and shared queue integration follow in Phase 8. `MANUAL_TESTING.md` includes both workflows. No return/stock acceptance or full-suite pass is claimed.

Lightweight checkpoint: `npm run typecheck` exit 0 after fixing stock period narrowing and the variance route type; Webpack compiled and generated 6/6 pages. Full business suites and manual acceptance remain unrun by request.

## Phase 8 implementation plan — before coding

Connect discrepancies to one role/team-scoped worklist with stable identity, evidence-change reopening, ownership, priority, deadlines and human reasons. Add append-only comments and authorized evidence references without exposing internal discussions to distributors. Implement saved-result reports/Overview, permitted exports, scoped audit and in-app notifications. Add deadline scheduling using company time zones. Add an explicitly configured OpenAI Responses adapter for cited explanations, management questions and document extraction drafts, with strict output validation, current access checks, cache/idempotency, usage reservation, no automatic retry of uncertain charges and manual fallbacks. Human extraction confirmation creates a separate evidence draft, never an approval or financial operation. Actual AI provider configuration remains blocked; do not fake a connected call. Manual acceptance includes team denial, scope changes, source reopening, traceable totals/exports, unsupported questions, invalid citations, outages and budget limits.

### Phase 8 implementation checkpoint

Connected stable discrepancy-to-team routing, scoped queue/detail/assignment/priority/deadline/human resolution, source-change reopening, immutable internal discussion and protected evidence references. Added saved-result Overview/reports with unknown valuation counts, evidence links, explicit-grant CSV export, scoped audit and in-app notification preferences. Hourly bounded jobs check credit/report deadlines, notify permitted people in-app and preserve human decisions. Source updates refresh dependent stock calculations and flag return support changes.

Added a configured-only OpenAI Responses adapter with strict advisory schema/citation validation, checked image/PDF input, human-confirmed extraction versions, current permissions before/after processing, model/prompt/schema metadata, token counts, conservative usage reservations, caching and no automatic reissue of uncertain calls. No model is silently selected and no provider call was made. Management questions are currently a controlled question selector; arbitrary natural-language questions, cross-year comparisons remain follow-up work. A later checkpoint links confirmed extraction to receipt prefilling without removing physical confirmation. Reservations are planning estimates, not provider invoice caps. Scanner and AI credentials remain absent; this is not an end-to-end acceptance pass. Official Convex generation/typechecking passes; full suites remain unrun by request.

Phase 8 lightweight checkpoint: official Convex generation/typechecking exit 0; `npm run typecheck` exit 0. Lint reported zero errors and five unused-import/destructuring warnings; these were corrected without changing any tests. No AI provider, file acceptance or manual business acceptance pass is claimed.

## Phase 9 implementation plan — before cleanup

Remove only verified-unused simulation code with its connected replacement already saved in Git. Keep approved design screenshots and unrelated artifacts/outputs. Add scoped operational health/blocked-job visibility, bounded remote responses, safe error boundaries and recovery guidance; retain conservative pilot limits. Align the architecture, source contracts, design notes, deferred work, environment example and manual checklist with actual connected behavior. Record remaining retention, production/MFA/provider/AI and manual acceptance gates. Run one final lint/type/build checkpoint and deploy the existing development backend; do not restart full automated suites or claim the original Definition of Done passes.

Phase 9 cleanup preserves all approved screenshots and unrelated artifacts/outputs. Removed unused generic simulated business tables/buttons and duplicate hard-coded zero cards after their connected replacements were committed. Added a safe workspace error/reload boundary, bounded streaming provider responses, scoped service/job health visibility and honest retention/provider release status. Follow-up fixes enforce server-side credit-period filtering, preserve note-allocation correction history, recheck approved cases when receipt evidence changes, filter queue periods by source business period, offer missing-report months in global filters, and allow reviewed extraction evidence to prefill an unambiguous receipt line while retaining mandatory human physical confirmation.

Final review completed the case-level Assign review action and scoped historical-run inspection inside the existing Activity panels. Financial exposure is now withheld when a stock calculation has incomplete evidence, and table/AI queries avoid requesting manufacturer-only functions from distributor views. These are implementation fixes, not an additional automated acceptance claim.

A corrected accepted return file may correct its case date only when no active conflicting claim line remains; conflicting independent submissions still require review. Credited quantities are compared/displayed through stable logical return-line identity so source-version corrections do not erase the visible credit history.

## Final manual-first handoff checkpoint

```text
npm run lint                                  exit 0; no warnings/errors
npm run typecheck                             exit 0
npm run build                                 exit 0
  Compiled successfully in 5.6s
  Finished TypeScript in 8.9s
  Generated 6/6 static pages; all application/evidence routes listed
npx convex dev --once --tail-logs disable       exit 0; Convex functions ready (10.13s)
git diff --check                              exit 0
localhost:3000 landing availability            HTTP 200
```

Full unit/integration/Playwright/accessibility suites were not run during the implementation-first continuation, as requested. No manual acceptance box is checked. `IMPLEMENTATION_REPORT.md` lists all ten Definition of Done items as FAIL/unverified until full evidence exists. The application preview is already listening on localhost:3000; the existing development backend has the final functions. No production deployment or GitHub push was performed. The approved design files and unrelated artifacts/outputs are preserved; no secrets or client uploads were added.
