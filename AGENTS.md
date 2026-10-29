# PharmaAI project instructions

PharmaAI is a web-first application for pharmaceutical manufacturers.

## Project and stack

- Work in this existing `pharmaAI` folder and repository. Do not create a separate project or repository for the web application.
- Follow `PLAN.md` for the product scope and target web stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Clerk, and Convex.
- The UI runs on Next.js App Router with TypeScript and Tailwind CSS. The landing page uses synthetic data; Clerk authentication and Convex backend/data work are later phases. Stay in the UI phase unless the user requests backend work.
- Preserve the design references, relevant assets, product content, and unrelated user changes.
- Native iOS and Android apps are outside the current scope. Do not add native features, EAS workflows, or mobile-only dependencies.
- Verify current official documentation and installed versions before introducing or changing framework APIs.

## UI implementation

- Use responsive browser layouts, accessible HTML, keyboard navigation, visible focus states, and reusable components.
- Match each design reference at its original viewport dimensions. For `design/landing-page.png`, use 1440 × 1024.
- Also test desktop, tablet, and mobile browser widths, including intermediate widths such as 1024 and 1280 pixels.
- Check text wrapping, currency amounts, clipping, and horizontal overflow. Financial amounts must remain readable.
- Capture browser screenshots, compare with the reference, refine, and report any remaining material differences.
- Test interactions separately from visual appearance.
- Clearly distinguish demo behavior from connected backend functionality. Never imply that an account, upload, or financial operation succeeded when it did not.

## Validation and handoff

- Run lint, typecheck, and relevant checks before finishing. Run the production build for the framework migration and changes affecting deployment.
- Use `npm run dev` for the preview at localhost:3000. Validate with `npm run lint`, `npm run typecheck`, and `npm run build`. Run `npm run test:e2e` for browser verification; see README.md for browser prerequisites.
- Keep secrets out of source code and screenshots.
- Report changed files, validation results, remaining limitations, and how to preview the result.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
