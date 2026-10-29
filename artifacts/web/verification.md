# Web UI migration verification

Date: 28 October 2026

- Same local folder and GitHub remote: `gouthamprabhakar/pharmaAI`.
- Next.js 16.4.3, React 19.3.1, TypeScript, and Tailwind CSS 4.3.3 replace the Expo runtime.
- This milestone is UI only. Authentication, database connections, uploads, and real reconciliation are not implemented.
- `npm run lint`: passed, no warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed; public routes are prerendered and workspace routes are server-rendered on demand.
- `npm run test:e2e -- --project=chromium`: 22 tests passed in Chrome. WebKit was not rerun because its temporary browser download was removed to conserve disk space.
- Tested widths: 320, 390, 640, 768, 1024, 1100, 1180, 1280, 1440, and 1920 CSS pixels.
- All three currency amounts remain on one line with no clipping at every tested width.
- Navigation, sample evidence, source previews, dialog dismissal, focus restoration, authentication feedback, tabs, search, filters, and honest demo actions passed.
- All 35 routes returned successfully at 1440 × 1024. Automated WCAG A/AA checks passed for the landing, authentication, invitation, onboarding, workspace-table, settings-card, and system-state layout families. Automated checks are not a complete accessibility audit.
- Server-rendered content also works without JavaScript; interactive demo dialogs require JavaScript.
- Dependency audit after updating the transitive lint dependency: zero reported vulnerabilities.

## Visual review

Compared the 1440 × 1024 Chrome screenshot against `design/landing-page.png` and refined button typography, card height, and section spacing. Desktop composition closely follows the reference. Minor font metrics and recreated icon strokes differ; this is not asserted to be pixel-identical. Tablet and mobile layouts intentionally stack sections to keep content readable. Also inspected WebKit output.

Compared `/sign-in` at 1440 × 1024 against `design/auth-sign-in-code-expired.png` and refined the two-column geometry, form spacing, verification-code sizing, and muted-text contrast. The desktop composition is closely aligned; minor differences remain in recreated icon strokes and font rasterization. At 899 pixels and below, the informational panel is intentionally removed so the form remains readable. Verified 1440, 1280, 1024, 768, 390, and 320 pixel widths with no horizontal overflow.

Implemented the remaining 33 references using reusable invitation, onboarding, signed-in workspace, settings, and system-state layouts. Each route has a final 1440 × 1024 capture in `artifacts/web/screens/`; representative layout families also have 1024 and 390 pixel captures. All 35 routes were checked at 1280, 1024, 768, 390, and 320 pixels with no page-level horizontal overflow. The route-by-route visual audit and intentional simplifications are recorded in `screen-status.md`.

Retained screenshots:

- `landing-chromium-1440.png`
- `landing-chromium-1024.png`
- `landing-chromium-390.png`
- `auth-sign-in-1440.png`
- `auth-sign-in-1024.png`
- `auth-sign-in-390.png`
- `screens/01-landing-page.png` through `screens/35-system-edge-states.png`
- `screens/responsive-*-1024.png` and `screens/responsive-*-390.png`

## Cleanup

Removed 384.5 MiB of obsolete and temporary files, measured from allocated disk usage before deletion. This includes Expo caches and starter assets, superseded screenshots, temporary font/test tooling, build cache, and the WebKit/FFmpeg downloads created for verification. It is not a net comparison of the old and new dependency trees. The install also removed 475 obsolete dependency packages. Original designs, local fonts and license, source code, Git history, and the remote were retained.

After the 35-screen verification, the regenerated `.next` cache (124 MiB), test traces, and duplicate screenshots were removed again. The retained 35 desktop captures and ten representative responsive captures use approximately 5.7 MiB.

Run `npx playwright install webkit` before rerunning the full suite. No commits, pushes, or deployments were made.
