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

- `/`: responsive landing page based on `design/landing-page.png`, including synthetic evidence dialogs and product information.
- `/sign-in`: the branded Google-only Clerk sign-in flow for the pilot. Other sign-in and account-creation methods are intentionally not exposed.
- `/workspace-invitation` and `/setup`: fictional invitation and guided manufacturer workspace setup.
- `/overview`, `/returns`, `/sales`, and `/review-queue`: the four primary MVP work areas.
- `/data`, `/reports`, and `/administration`: supporting intake, reporting, and administration areas.
- Clerk and Convex packages, local development projects, provider wiring, and the initial deployed schema are present. The visible sign-in experience and product screens still use demonstration behavior; protected live queries and mutations are not connected yet.
- Upload processing, reconciliation calculations, and connected AI are still planned phases; the current records remain fictional.

## Clerk and Convex foundation

The Clerk and Convex development projects are already linked on this computer. A new developer should copy `.env.example` to `.env.local`, link their authorized development access, and never commit the populated local environment file.

The app keeps its fictional UI available when environment values are absent. With the local values configured, the shared provider layer can connect Clerk identity to Convex. The initial Convex schema covers organizations, users and roles, operational units, distributors, products, submissions, evidence files, return cases, stock variances, review items, audit events, and evidence-linked AI metadata. This foundation does not by itself make the current UI data live.

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
