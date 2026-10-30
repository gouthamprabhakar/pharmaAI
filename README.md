# PharmaAI

A web-first pharmaceutical reconciliation application, built with Next.js App Router, React, TypeScript, Tailwind CSS, Clerk, and Convex in this existing repository.

## Run locally

Requires Node.js 20.9 or newer and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000**. The previous Expo preview on port 8081 is obsolete.

For backend development, keep a second terminal open in the same folder:

```bash
npx convex dev
```

The first terminal serves the website. The second watches `convex/` and synchronizes backend changes to the linked Convex development deployment; it does not create another localhost page.

## Current scope

Deferred work and its revisit criteria are tracked in [`todo.md`](todo.md). MFA is optional only for the explicitly configured development demo; production security and live-provider verification remain outstanding.

- `/`: responsive landing page based on `design/landing-page.png`, including synthetic evidence dialogs and product information.
- `/sign-in`: the branded Google-only Clerk sign-in flow for the pilot. Other sign-in and account-creation methods are intentionally not exposed.
- `/workspace-invitation`: invitation context; `/setup`: persistent guided manufacturer configuration for authorized owners/administrators.
- `/overview`, `/returns`, `/sales`, and `/review-queue`: the four primary MVP work areas.
- `/data`, `/reports`, and `/administration`: supporting intake, reporting, and administration areas.
- Clerk and Convex development projects are reused. Phase 3 adds protected workspace pages and current membership/role/unit/distributor authorization. Workspace identity comes from the authorized organization. Live organization configuration and MFA gates are tracked in `PROGRESS.md`; business workflows remain unconnected.
- Upload processing, reconciliation calculations, and connected AI are still planned phases; the current records remain fictional.

## Clerk and Convex foundation

The Clerk and Convex development projects are already linked on this computer. A new developer should copy `.env.example` to `.env.local`, link their authorized development access, and never commit the populated local environment file.

Workspace pages fail closed when authentication configuration is absent. With configured development values, Clerk identity reaches Convex, which must additionally verify the active organization, membership and permitted scope. See `AUTHORIZATION.md` for MFA, invitation delivery and synchronization limitations. This foundation does not make intake, reconciliation or AI connected.

## Backend verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
```

Unit/integration tests use fictional identities in the official Convex test harness. Browser tests run the production build on localhost:3100 and use `*.spec.ts`; Vitest uses `*.test.ts`. The production build uses Next.js's supported Webpack mode after a verified Turbopack worker restriction. A passing anonymous-access browser test is not proof of an authenticated business workflow. The outstanding live gates and all phase results are recorded in `PROGRESS.md`.

Authenticated browser tests also use the official Clerk development helpers and isolated fictional accounts. They require linked development credentials and the Convex development setting `PHARMAAI_ENABLE_TEST_FIXTURES=true`; production is rejected. The helper's ticket sign-in is not a Google OAuth/MFA test. Test-session traces are off, transient metadata is ignored under `.test-state/`, only run-marked Clerk resources are removed, and historical Convex fixtures are deactivated.

Administration > Team & access is connected for scoped member lists and invitation operations. Sending uses `CLERK_SECRET_KEY` and `PHARMAAI_APP_URL` on Convex; missing configuration is displayed honestly. The verified event receiver is `https://<deployment>.convex.site/clerk/webhook` and requires `CLERK_WEBHOOK_SIGNING_SECRET` plus `CLERK_INSTANCE_ID` on Convex. It returns 503 until configured. Never paste these secrets into chat or commit them.

Administration's structure, distributor, rules and product/template actions now save scoped configuration and preserve versions/audits. `/setup` resumes its saved position. Exact quantities/rates use decimal.js 10.6.0, paise must be safe integers, and policy rates/rounding are explicit. Fictional master-data seeding requires `PHARMAAI_ENABLE_FICTIONAL_SEED=true`, a development environment and development Clerk issuer together; it is disabled by default and never runs automatically.

The user requested manual acceptance instead of repeated full test runs. Existing tests are preserved. Later implementation is not certified by earlier passing test counts; see `PROGRESS.md` and `MANUAL_TESTING.md` as it is completed.

Data Intake now has scoped uploads, quarantined evidence, controlled Excel/CSV downloads, persisted processing/history, record corrections, explicit partial/warning confirmation and duplicate prevention. File acceptance requires an approved malware/DLP adapter. Set `FILE_SCAN_URL` and `FILE_SCAN_API_KEY` on Convex only. It receives the raw file with SHA-256 and must return `{sha256, verdict: "clean" | "unsafe", patientDataDetected: boolean, engine, engineVersion}`. Unknown/unconfigured responses block acceptance. No scanner bypass is enabled. Original downloads pass through authenticated `/api/evidence/[id]`; storage URLs are not returned to browsers.

## Where to edit

| File | Purpose |
| --- | --- |
| `src/app/page.tsx` | Home route |
| `src/components/SignupLanding.tsx` | Landing-page content and interactions |
| `src/app/globals.css` | Design tokens and responsive layout |
| `src/app/layout.tsx` | Shared HTML layout, local fonts, metadata |
| `src/app/sign-in/page.tsx` | Sign-in route |
| `src/components/auth-sign-in.tsx` | Responsive authentication and expired-code preview |
| `src/app/[...slug]/page.tsx` | Routes for invitation, onboarding, workspace, settings, and system-state screens |
| `src/components/workspace-demo.tsx` | Shared shells, screen definitions, fictional data, and demo interactions |
| `src/components/ui/` | Shared UI primitives; shadcn configuration is in `components.json` |
| `design/` | Original design references |
| `artifacts/web/` | Browser verification screenshots |
| `tests/landing.spec.ts` | Responsive layout, interaction, accessibility, and SSR checks |
| `tests/workspace.spec.ts` | All-route smoke tests, responsive families, demo interactions, and WCAG checks |
| `artifacts/web/screen-status.md` | Route-by-route completion and remaining-difference audit |

## Validate

```bash
npm run lint
npm run typecheck
npm run build
```

The browser tests run against a production server on port 3100. The temporary WebKit download was removed after verification to save disk space. Install it before running the full suite again; Chromium tests use the installed Google Chrome browser:

```bash
npx playwright install webkit
npm run test:e2e
```

The tests cover all 35 routes, 320 through 1920 pixel widths, critical financial amounts, navigation, tabs, search, demo feedback, dialogs, keyboard focus, automated accessibility checks, and rendering without JavaScript. Final desktop screenshots and representative tablet/mobile captures are retained in `artifacts/web/screens/`.

For a local production preview, run `npm run build` followed by `npm start`.

## Repository and migration

This is the same `pharmaAI` folder and GitHub repository. The Expo runtime, React Native entry points, and mobile scripts have been replaced with Next.js. Original design files and assets are retained. Git history and the remote are unchanged. Local edits do not publish the app or push commits to GitHub.

Read `AGENTS.md` for development instructions and `PLAN.md` for the product roadmap.
