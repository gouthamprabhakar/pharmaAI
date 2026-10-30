# PharmaAI project instructions

PharmaAI is a web-first evidence and exception-management application for pharmaceutical manufacturers. The approved MVP contains two business controls: Returns & Credits reconciliation and Distributor Sales & Stock reconciliation.

## Project and stack

- Work in this existing `pharmaAI` folder and repository. Do not create a separate project or repository for the web application.
- Follow `PLAN.md` for implementation and `MVP_SPEC.md` for the approved product definition, workflow boundaries, evidence ownership, AI role, screen consolidation, assumptions, and risks.
- Use Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Clerk, and Convex. Confirm installed versions and read the relevant bundled Next.js documentation before using framework APIs.
- Development Google authentication and current organization/role/unit/distributor authorization are implemented. Configuration, protected intake jobs, return/credit and stock calculations, queue, reports, audit and in-app notification operations are wired to Convex. Advisory AI has a configured-only provider adapter, structured validation and manual fallbacks. Automated malware/DLP scanning was explicitly removed from the MVP by the user and is deferred in `todo.md`; uploads still require permission, file metadata, template, structural validation and a no-patient-data declaration. AI remains unavailable without an approved key/model and enabled usage controls. Business acceptance is pending. MFA is optional only for explicitly configured development by user approval; native MFA proof, external identity events and observed invitation delivery remain release gates. Never equate compiled code or older access tests with a complete MVP.
- Preserve relevant product content and unrelated user changes. When replacing an obsolete screen or asset, verify its approved replacement and keep recovery available through Git before removing it.
- Native iOS and Android apps are outside the current scope. Do not add native features, EAS workflows, or mobile-only dependencies.

## MVP product boundaries

- Keep four primary work areas: Overview, Returns & Credits, Sales & Stock, and Review Queue.
- Keep Data Intake, Reports, and Administration as supporting areas. Do not reintroduce all former design states as primary navigation destinations.
- Treat processing, mapping, validation, extraction review, reconciliation runs, notifications, and adjustments as steps, panels, dialogs, or administrative history where `MVP_SPEC.md` specifies.
- Standard distributor templates and deadlines are part of the MVP. Distributor access is restricted to that distributor's submissions and permitted statuses.
- Deterministic software owns validation, calculations, permissions, policies, and status transitions. AI may extract, suggest matches, explain with citations, summarize, prioritize, and answer evidence-backed questions.
- AI must never approve returns, issue credits, change inventory, resolve exceptions, modify policies, or bypass permissions.
- Human users confirm consequential return, credit, adjustment, and resolution decisions. Preserve the original evidence, rule version, calculation snapshot, AI metadata, correction, actor, reason, and audit event.
- Do not claim a market gap, customer relationship, working AI, connected backend, completed upload, financial action, or inventory change when it has not been verified.

## UI implementation

- Use responsive browser layouts, accessible HTML, keyboard navigation, visible focus states, and reusable components.
- Redesign against the approved 12-view structure in `MVP_SPEC.md`. Do not blindly preserve obsolete screens merely because an old reference exists.
- Maintain a traceable decision for every old design: keep, merge, move, remove as a destination, or replace. Update the `design/` folder when the revised references are approved.
- Match approved design references at their original viewport dimensions. For `design/landing-page.png`, use 1440 × 1024 unless its approved replacement specifies another viewport.
- Also test desktop, tablet, and mobile browser widths, including intermediate widths such as 1024 and 1280 pixels.
- Check text wrapping, currency amounts, clipping, and horizontal overflow. Financial amounts must remain readable.
- Capture browser screenshots, compare with the reference, refine, and report any remaining material differences.
- Test interactions separately from visual appearance.
- Clearly distinguish demo behavior from connected backend functionality. Never imply that an account, upload, or financial operation succeeded when it did not.

## Implementation sequence

1. Keep the current application recoverable in Git.
2. Update the plan and approved design references before broad code changes.
3. Implement and validate representative Overview, Return Case Workspace, and Variance Workspace screens first.
4. Consolidate the remaining routes and components around the approved structure.
5. Add backend, authentication, file processing, reconciliation, and AI only in their planned phases.
6. Remove obsolete routes, components, dependencies, and design assets only after replacements are verified.

## Clerk and Convex development

- The root `AGENTS.md` governs both the Next.js application and the `convex/` backend. Do not add generated or duplicate agent instruction files unless a genuinely different directory-specific rule is required.
- The existing Clerk application and Convex project are already linked for development. Do not create replacement projects during routine setup.
- Run the browser application with `npm run dev` and keep `npx convex dev` running in a second terminal while developing backend functions.
- Treat `convex/schema.ts` as the source of truth for the operational data model. Do not hand-edit files under `convex/_generated/`.
- Keep all credentials in the ignored local environment file or provider dashboards. Never print, commit, screenshot, or copy secrets into documentation.
- Every protected Convex function must derive the signed-in Clerk identity and enforce organization, role, operational-unit, and distributor scope before reading or changing data.
- Do not enable Clerk Organizations, production instances, or external integrations silently. Confirm the product decision and production requirements first.

## Validation and handoff

- On 30 October 2026 the user requested implementation-first with manual acceptance to reduce test usage. Preserve automated tests, but do not repeatedly run the full unit/integration/browser suites unless requested again. Use lightweight type/build checks and record unrun coverage honestly. The earlier all-phase automated loop is superseded by this user instruction; release security and Definition of Done requirements are not waived.

- Record newly deferred work in `todo.md`, including the trigger for revisiting it and its acceptance evidence. The user approved MFA being optional only for the development demo; never broaden that exception to production or bypass Google identity, membership, role, unit or distributor authorization.

- Run lint, typecheck, and relevant checks before finishing. Run the production build for the framework migration and changes affecting deployment.
- Use `npm run dev` for the preview at localhost:3000. Validate with `npm run lint`, `npm run typecheck`, and `npm run build`. Run `npm run test:e2e` for browser verification; see README.md for browser prerequisites.
- Keep secrets out of source code and screenshots.
- Report changed files, removed files, validation results, remaining limitations, demo-versus-connected behavior, and how to preview the result.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
