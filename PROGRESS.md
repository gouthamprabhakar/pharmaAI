# Backend implementation progress

Started: 30 October 2026. Authority: MVP_SPEC.md > PLAN.md > AGENTS.md > design references.

## Phase gates

| Phase | Status | Exit evidence required |
|---|---|---|
| 3 Authentication and authorization | Blocked on live provider setup; code checks green | Organizations confirmation, MFA enrollment, provider synchronization and authenticated browser coverage still required |
| 4 Data foundation | Pending Phase 3 | Strict configuration, exact arithmetic, append-only audit, idempotency, fictional seed guard |
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

## Baseline findings

- Clerk and Convex packages and provider wiring exist; live business records and file processing do not.
- The existing viewer query returns only identity; no membership authorization helper exists.
- Existing browser tests still assume the earlier synthetic demonstration. Their expectations must be reconciled with protected routes without weakening security or deleting coverage.
- Existing source hard-codes a real prospect as manufacturer context, contrary to the current specification. Replace runtime identity with authorized organization data.
- Prior production checks reported an internal Next.js bundler failure. Reproduce before claiming build readiness.

## Blocked

1. **Clerk Organizations — resolved:** the user explicitly approved enablement for the existing development app on 30 October 2026. The change was previewed, applied and read back. Final configuration: Organizations enabled, forced organization selection off, automatic organization creation off. Clerk initially turned forced selection on by default; a previewed correction restored the approved off setting. No invitations were sent and no replacement app was created. This resolves the earlier automatic-approval rejection, not the remaining MFA/membership gates.
2. **MFA:** read-only provider inspection verified the current development account has `two_factor_enabled = false` and `totp_enabled = false`. Owner/admin access is deliberately denied without signed second-factor proof. Enrollment requires the account holder.
3. **Provider synchronization and live positive coverage:** application membership provisioning, Clerk invitation delivery, external Clerk membership/session removal synchronization, and real signed organization/MFA claim verification remain incomplete. App membership revocation is tested; this is not proof of immediate external Clerk revocation. Prepared invitations return `not_sent`.

The source-of-truth phase gate prevents moving to Phase 4 while Phase 3 is incomplete. Phase 4–8 business workflows and Phase 9 cleanup/monitoring have not been claimed or implemented by this checkpoint. Independent work completed includes all-screen contract mapping, fail-closed authorization, invitation preparation/acceptance/revocation, audit/idempotency tests, browser denial tests and build recovery.

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
