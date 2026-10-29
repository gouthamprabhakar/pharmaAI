# PharmaAI

A web-first pharmaceutical reconciliation application, built with Next.js App Router, React, TypeScript, and Tailwind CSS in this existing repository.

## Run locally

Requires Node.js 20.9 or newer and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000**. The previous Expo preview on port 8081 is obsolete.

## Current scope

- `/`: responsive landing page based on `design/landing-page.png`, including synthetic evidence dialogs and product information.
- `/sign-in`: an explicitly labeled email authentication preview. No sign-in codes are sent, accounts created, or credentials stored.
- `/workspace-invitation` and `/onboarding/*`: fictional invitation and four-step manufacturer workspace setup.
- `/overview`, `/imports/*`, `/documents/*`, `/returns/*`, `/sales/*`, `/review-queue/*`, `/reports`, `/notifications`, `/team`, `/audit-history`, and `/settings/*`: the complete 35-screen UI demonstration with consistent fictional records.
- `/system-states`: accessible empty, error, permission, processing, and recovery patterns.
- Clerk authentication, Convex data, uploads, and real reconciliation are subsequent phases in `PLAN.md`; they are not connected in this milestone.

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
