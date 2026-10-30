# PharmaAI

A web-first evidence and exception-management application for pharmaceutical manufacturers, built in this existing repository. Product authority is `MVP_SPEC.md`, then `PLAN.md`, then `AGENTS.md`.

## Run locally

Use two terminals in this folder:

```bash
npm run dev
```

```bash
npx convex dev
```

Open [localhost:3000](http://localhost:3000). The browser application runs locally; Convex watches this repository and synchronizes the existing cloud development deployment. Do not create replacement Clerk or Convex projects. Local commits do not publish the website or push GitHub changes.

Credentials belong only in ignored `.env.local` or provider settings. `.env.example` lists names without values. Configure backend secrets on Convex, never with a `NEXT_PUBLIC_` prefix. Never paste secrets into chat or commit them.

## Working areas

- `/`: public landing with labelled fictional examples; `/sign-in`: invited Google sign-in.
- `/setup`: saved manufacturer configuration, products, units, distributors, rules and templates.
- `/overview`: saved-result summary, recent submissions and scoped advisory brief.
- `/data`: controlled Excel/CSV templates, quarantined uploads, validation/correction, human confirmation, history and recovery.
- `/returns`, `/returns/<record id>`: return evidence, manufacturer receipt/photos, deterministic eligibility, human decisions, Finance worklist and issued-credit matching.
- `/sales`, `/sales/<record id>`: monthly reporting compliance, exact stock equation, opening baseline, tolerance/valuation and evidenced human variance actions.
- `/review-queue`: stable team-routed tasks with integrated detail, assignment, deadlines, comments and evidence references.
- `/reports`: scoped saved-result reporting, source drill-through and permission-controlled CSV export.
- `/administration`: configuration, Team & access, AI controls, account security, audit, in-app notifications and basic operational health.

The approved twelve-view structure remains. Processing, extraction, adjustments, notifications and run history are supporting states rather than new primary destinations. The same VS Code project contains the Next.js UI and `convex/` functions.

## Current connection and acceptance limits

Access and configuration are connected. Business functions and screens are implemented; manual business acceptance is pending. Read `IMPLEMENTATION_REPORT.md`, `PROGRESS.md` and `MANUAL_TESTING.md` for evidence.

- Upload acceptance requires an approved HTTPS malware/DLP service using `FILE_SCAN_URL` and `FILE_SCAN_API_KEY`. The adapter requires matching SHA-256, clean/unsafe verdict, patient-data result, engine and version. Missing or inconclusive checks leave files quarantined. There is no development scan bypass.
- Advisory AI requires `OPENAI_API_KEY`, an explicitly approved `PHARMAAI_AI_MODEL`, and enabled organization usage controls. No model/key is configured or inferred. Clean images/PDFs can produce reviewed extraction drafts; AI cannot approve, credit, change inventory or resolve work. See the [official structured-output guide](https://developers.openai.com/api/docs/guides/structured-outputs).
- Usage reservations are conservative planning estimates, not provider billing caps. Unchanged/uncertain requests are reused, not automatically sent again. Current management questions are controlled choices.
- MFA is optional only for explicitly configured development. Native MFA/reverification, external Clerk event activation and actual invitation receipt remain release gates. The signed event receiver returns 503 until configured with `CLERK_WEBHOOK_SIGNING_SECRET` and `CLERK_INSTANCE_ID`.
- Use fictional data only. No real-client readiness, compliance certification, production deployment, backup recovery or retention approval is implied.

## Implementation and limits

Money is safe integer INR paise. Decimal quantities, rates, taxes and stock calculations use decimal.js; confirmed evidence/calculations/audits are versioned and append-only. Every protected function checks current organization, role, unit and distributor grants. Uploaded originals use protected routes, not browser-visible storage URLs.

Pilot limits: 5 MiB files, 20 MiB decompressed XLSX, 2,000 archive entries, 1,000 data records, 100 lines per return case, 5,000 source facts per scoped calculation and 1,000 report records. Exceeding a limit is explicit. No valuation rate, first opening balance, tax policy, missing manufacturer evidence or invoice relationship is guessed.

Fictional master seeding requires explicit development configuration (`PHARMAAI_ENABLE_FICTIONAL_SEED=true`, development environment and issuer together). It is disabled by default and never runs automatically.

## Checks

The user requested manual acceptance to reduce repeated test usage. Preserve the suites; do not treat earlier results as coverage of later changes. Basic implementation checks are:

```bash
npm run lint
npm run typecheck
npm run build
```

The production build uses supported Next.js Webpack mode. When full verification is requested again:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

Browser tests use port 3100 and isolated fictional Clerk sessions. WebKit may require `npx playwright install webkit`; Chromium uses the installed Google Chrome. These sessions do not prove Google OAuth or MFA. Never run development fixtures in production. See `OPERATIONS.md` and `todo.md` before client use.
