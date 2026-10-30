# Backend implementation progress

Started: 30 October 2026. Authority: MVP_SPEC.md > PLAN.md > AGENTS.md > design references.

## Phase gates

| Phase | Status | Exit evidence required |
|---|---|---|
| 3 Authentication and authorization | In progress | Current identity, active membership, organization, role, unit and distributor checks; MFA and step-up; revocation; invitation tests; browser checks |
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

No blockers verified yet. External account configuration, MFA enrollment, scanning provider and AI provider will be recorded here if required access or decisions are unavailable.

## Verification log

Pending initial execution.
