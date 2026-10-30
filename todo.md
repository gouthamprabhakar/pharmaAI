# Deferred work

- [ ] **Manual acceptance handoff:** the user requested building the remaining features before manual testing. Preserve existing tests; do not repeatedly run full suites. Record changes since the last verified checkpoint as unverified, provide a manual workflow checklist, and revisit automated coverage before release or when requested.

Updated: 30 October 2026. Track deferred decisions here; implementation evidence belongs in `PROGRESS.md`. Product scope remains governed by `MVP_SPEC.md` and `PLAN.md`. An unchecked item is not working functionality.

## Deferred security work — required before real client use

- [ ] **SEC-06 — Connect and verify the file malware/DLP adapter.** Configure the approved HTTPS service and secret locally/on Convex, verify clean/malicious/prohibited-data/outage/checksum cases, then manually exercise acceptance. Files remain quarantined while absent; no development scan bypass is authorized.
- [ ] **AI-01 — Connect an approved AI provider/model.** No AI key/model is configured locally. Keep AI unavailable with manual/deterministic fallbacks until explicit provider setup and evidence-linked output verification.

The user approved making MFA optional for the development demo only. Google sign-in, organization membership, roles, unit and distributor restrictions remain required. This exception does not approve a production release or real client uploads.

- [ ] **SEC-01 — Enroll owner/admin MFA and store recovery codes privately.** Revisit before real client access. The account holder must scan and confirm the authenticator themselves. Verify a fresh Google sign-in plus a second factor; never collect QR seeds or recovery codes in chat, logs or screenshots. Authenticator and recovery-code options are already enabled in the existing Clerk development app.
- [ ] **SEC-02 — Connect native Clerk MFA proof and sensitive-action reverification to Convex.** Convex deliberately excludes `fva` from `getUserIdentity()`, so the current direct-claim tests do not prove live MFA. Design a server-verified, session/subject/organization-bound proof using current official guidance. Verify signature, issuer, origin, expiry and current provider state; retain no raw token. Test forged/replayed/expired/cross-session/cross-tenant proof, missing second factor, freshness and provider outage. No unfinished verification bridge is retained as connected code.
- [ ] **SEC-03 — Activate external Clerk event delivery.** The signed Convex receiver, event deduplication, removals/downgrades, session revocation and retained history are implemented and tested with real signature verification. Register the development endpoint/signing secret in Clerk, then verify real external event delivery and retry behavior. The receiver fails closed while unconfigured. Webhooks are asynchronous; do not promise instantaneous external revocation.
- [ ] **SEC-04 — Verify external invitation delivery.** Delivery jobs and the Team & access UI now use the official Clerk SDK, configured development credentials, current scope checks, explicit states and safe uncertain-result recovery. Provider-boundary tests simulate responses without sending real-person emails. Scoped acceptance with genuine sessions and signed verified-email claims passes. Still verify an authorized provider request and actual receipt before claiming inbox delivery.
- [ ] **SEC-05 — Remove the development MFA exception before client use.** Opt-in must require a development environment, development Clerk issuer and explicit flag together. Production must deny the exception even if the flag is accidentally set. Prove both allowed and denied cases. Do not mark Phase 3 complete while its remaining work is unverified.
- [x] **QA-01 — Development authenticated access coverage.** Genuine Clerk sessions now cover owner and distributor access, cross-tenant/finance/unit/distributor denial, an uninvited user, sign-out, scoped invitation acceptance, team-dialog accessibility/keyboard/mobile fit and immediate application membership removal. Fixtures use fictional accounts, not production authentication bypasses.
- [ ] **QA-02 — Remaining live security/browser coverage.** Complete MFA/reverification after SEC-01/02, externally delivered revocations after SEC-03, session-expiry and remaining supported-browser checks. The development ticket-based test helper does not prove Google OAuth or MFA.
- [ ] **REL-01 — Client-data and production readiness.** Confirm region/data residency, retention, privacy/contracts, AI processing, access, encryption, monitoring, backup/recovery and representative files/volumes against PLAN sections 24–25 before real uploads.

## Implemented scope awaiting manual acceptance

Code completion below does not certify release acceptance. Follow `MANUAL_TESTING.md` and the unresolved gates above.

- [x] **Phase 4 code:** persistent configuration, exact arithmetic, immutable history/audit, idempotency and development seed guard.
- [x] **Phase 5 code:** controlled templates/downloads, quarantined uploads, scan/parse/validation, correction, confirmation, history and retry recovery. Live acceptance blocked by SEC-06.
- [x] **Phase 6 code:** return receipt/photos, confirmed extraction linkage, versioned eligibility, human approval, Finance worklist, single/bulk credits, exact/partial/excess matching and closure.
- [x] **Phase 7 code:** monthly reporting compliance, full stock equation, independent manufacturer receipts, opening confirmation, tolerance/valuation, corrections, adjustments and human variance actions.
- [x] **Phase 8 code:** team-routed queue, ownership/due dates, comments/evidence, scoped reports/export/audit, in-app alerts and configured-only advisory AI.
- [x] **Phase 9 code:** remove obsolete business simulations, bounded provider responses, operational visibility, safe errors and handoff guidance. Production readiness itself is not complete.
- [ ] **QA-03 — Manual business acceptance and subsequent automated regression:** run all checklist cases after provider setup; restore full automated verification before release or when requested. Old passing results do not cover new business code.
- [ ] **OPS-01 — Observability/backup/recovery/retention approval:** approve provider alerting, backup/restore procedures, retention/deletion and support ownership before real client use. Current in-app health is basic; no external monitoring service is silently enabled.
- [ ] **DATA-01 — Pilot coverage/scale validation:** verify real policy/rate/credit grouping, first-opening evidence, missing-batch behavior, zero-receipt periods and replacement reports. Current pilot limits are explicit, not silently truncated. Configure an explicit no-receipt evidence source before supporting a period with no manufacturer shipment file.
- [ ] **AI-02 — Acceptance of provider behavior and cost estimates:** verify checked photo/PDF extraction, ambiguous matching, citations, scope removal, refusals, token usage and conservative reservations with the selected model. Reservations are estimates, not invoice caps. Arbitrary natural-language questions and cross-year comparison are not implemented; the current selector supports controlled questions.
- [ ] **UI-01 — Manual browser/keyboard/reference review:** verify the new connected panels at 390/768/1024/1280/1440 widths and across supported browsers. Approved screenshots are retained; no unverified capture replaces them.

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
