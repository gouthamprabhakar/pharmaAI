# Deferred work

Updated: 30 October 2026. Track deferred decisions here; implementation evidence belongs in `PROGRESS.md`. Product scope remains governed by `MVP_SPEC.md` and `PLAN.md`. An unchecked item is not working functionality.

## Deferred security work — required before real client use

The user approved making MFA optional for the development demo only. Google sign-in, organization membership, roles, unit and distributor restrictions remain required. This exception does not approve a production release or real client uploads.

- [ ] **SEC-01 — Enroll owner/admin MFA and store recovery codes privately.** Revisit before real client access. The account holder must scan and confirm the authenticator themselves. Verify a fresh Google sign-in plus a second factor; never collect QR seeds or recovery codes in chat, logs or screenshots. Authenticator and recovery-code options are already enabled in the existing Clerk development app.
- [ ] **SEC-02 — Connect native Clerk MFA proof and sensitive-action reverification to Convex.** Convex deliberately excludes `fva` from `getUserIdentity()`, so the current direct-claim tests do not prove live MFA. Design a server-verified, session/subject/organization-bound proof using current official guidance. Verify signature, issuer, origin, expiry and current provider state; retain no raw token. Test forged/replayed/expired/cross-session/cross-tenant proof, missing second factor, freshness and provider outage. No unfinished verification bridge is retained as connected code.
- [ ] **SEC-03 — Activate external Clerk event delivery.** The signed Convex receiver, event deduplication, removals/downgrades, session revocation and retained history are implemented and tested with real signature verification. Register the development endpoint/signing secret in Clerk, then verify real external event delivery and retry behavior. The receiver fails closed while unconfigured. Webhooks are asynchronous; do not promise instantaneous external revocation.
- [ ] **SEC-04 — Verify external invitation delivery.** Delivery jobs and the Team & access UI now use the official Clerk SDK, configured development credentials, current scope checks, explicit states and safe uncertain-result recovery. Provider-boundary tests simulate responses without sending real-person emails. Scoped acceptance with genuine sessions and signed verified-email claims passes. Still verify an authorized provider request and actual receipt before claiming inbox delivery.
- [ ] **SEC-05 — Remove the development MFA exception before client use.** Opt-in must require a development environment, development Clerk issuer and explicit flag together. Production must deny the exception even if the flag is accidentally set. Prove both allowed and denied cases. Do not mark Phase 3 complete while its remaining work is unverified.
- [x] **QA-01 — Development authenticated access coverage.** Genuine Clerk sessions now cover owner and distributor access, cross-tenant/finance/unit/distributor denial, an uninvited user, sign-out, scoped invitation acceptance, team-dialog accessibility/keyboard/mobile fit and immediate application membership removal. Fixtures use fictional accounts, not production authentication bypasses.
- [ ] **QA-02 — Remaining live security/browser coverage.** Complete MFA/reverification after SEC-01/02, externally delivered revocations after SEC-03, session-expiry and remaining supported-browser checks. The development ticket-based test helper does not prove Google OAuth or MFA.
- [ ] **REL-01 — Client-data and production readiness.** Confirm region/data residency, retention, privacy/contracts, AI processing, access, encryption, monitoring, backup/recovery and representative files/volumes against PLAN sections 24–25 before real uploads.

## Existing MVP work still to implement

These are committed scope, not optional features removed from the MVP. Follow the phase gates and acceptance tests in `PLAN.md` and the screen contracts in `BACKEND_SCREEN_CONTRACT.md`.

- [ ] **Phase 4:** persistent configuration; exact arithmetic; immutable evidence/audit; idempotency; fictional seed guard.
- [ ] **Phase 5:** real templates/downloads, protected uploads, scan/parse/validation, correction, confirmation, history and retry/duplicate recovery.
- [ ] **Phase 6:** return receipt/photos, human extraction confirmation, versioned eligibility, approval, finance worklist, single/bulk credit recording, matching and closure.
- [ ] **Phase 7:** distributor reporting deadlines/compliance, complete stock equation, independent manufacturer shipments, corrections, adjustments and variance resolution.
- [ ] **Phase 8:** shared team-routed queue, scoped reports/exports, management AI with citations, output validation and fallback; connect notification/reminder/escalation behavior rather than only showing counts.
- [ ] **Phase 9, last:** cleanup, monitoring, accessibility, supported-browser/layout checks, recovery and production readiness.

## Beyond the approved first version

- [ ] **Deep integrations:** direct ERP, distributor-system, Pharmarack or SANeForce connections. First validate export/API availability and permission to use them; retain upload-based MVP support.
- [ ] **Forecasting and redistribution:** investigate only after real demand data and a validated customer problem are available.
- [ ] **Complex approvals:** configurable multi-level approval chains beyond the MVP human decision process.
- [ ] **Billing and subscriptions:** self-service billing and complex subscription management.
- [ ] **Additional languages and currencies:** the initial scope is English and INR.
- [ ] **Formal certification:** pursue only with verified requirements and evidence; make no certification claims beforehand.
- [ ] **Zoho migration/cost comparison:** retain Clerk and Convex for the current pilot as selected. Evaluate actual usage costs and migration effort before a platform change; do not assume migration takes only a couple of days.
- [ ] **Competitor demonstration research:** revisit authorized PharmScan demo access and SANeForce modules/pricing when available. Public marketing is not proof of private behavior or an integration opportunity.

## Setup already verified

- [x] Reuse the existing Clerk and Convex development projects.
- [x] Enable Clerk Organizations with automatic creation and forced selection off.
- [x] Enable authenticator-app and recovery-code options without forcing all users to enroll.
- [x] Create the fictional **PharmaAI Pilot** development workspace and verify the existing account's Clerk administrator membership.
- [x] Link the matching Convex owner membership with an audit event; retry reuses the same membership.
- [x] Add the approved development-only MFA exception, with tests denying production and missing/mismatched settings. Keep deferred production security visible in the plan and progress record.

Native mobile apps, autonomous financial/inventory decisions and patient-identifiable data remain excluded, not deferred implementation promises.
