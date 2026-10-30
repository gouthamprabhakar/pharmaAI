# Phase 3 authorization contract

The existing Clerk development app and Convex deployment are reused. No production instance, replacement project or real customer is provisioned by this work.

## Implemented locally

- Next.js checks authentication at the workspace page, in addition to Clerk request handling. Missing configuration fails closed.
- `convex/access.ts` exposes current workspace context, scoped capability checks, permission changes and preparation/acceptance of invitations.
- Every access function reads the signed-in identity and current application membership. Roles are never supplied as an authorization credential by a caller.
- Organization claims must match the configured Clerk organization. Units and distributors must be active and belong to the same organization. A distributor must be linked to the selected unit.
- Owner/admin require signed second-factor verification. Access changes require both factors verified within ten minutes. Missing claims deny access.
- Membership, user, organization, unit and distributor deactivation takes effect on the next Convex request. A revoked invitation cannot reactivate membership.
- Permission changes and invitation acceptance create append-only audit events. A stable key makes a retried access change or prepared invitation return its original result; a changed payload conflicts.
- An administrator cannot promote an owner, remove the final owner, or expand their own unit grant to all units.
- Invitation preparation returns `delivery: not_sent`. There is no provider delivery implementation, and no invitation email is sent by this interface.

## Provider prerequisites and remaining gaps

Live Clerk Organizations enablement requires explicit confirmation and was blocked by automatic approval review. The existing development user has no enrolled second factor. Those are live Phase 3 blockers, not successful end-to-end verification.

The native Clerk/Convex integration must provide signed organization context (`o.id` in Clerk session v2, `org_id` for legacy tokens, or configured `organization_id`) and `fva` claims to Convex. Conflicting claims deny access. Their presence in a live token remains to be verified; the code fails closed when missing. The authorization tests use `convex-test` identities and do not prove live provider claim configuration.

Application membership and Clerk membership must be provisioned and synchronized. Clerk membership deletion/session revocation outside PharmaAI still requires verified provider event synchronization; tests currently prove immediate application membership revocation only. Do not infer that an offline signed token proves current Clerk membership forever.

Clerk invitation delivery, MFA enrollment/reverification UI and live authenticated Playwright state still require completion. No signed-in workspace business workflows are marked connected by this phase.

## References reviewed

- [Clerk and Convex authentication](https://docs.convex.dev/auth/clerk)
- [Convex test harness](https://docs.convex.dev/testing/convex-test)
- [Clerk organization settings](https://clerk.com/docs/guides/organizations/configure)
- [Clerk reverification](https://clerk.com/docs/guides/secure/reverification)
- [Clerk session-token claims](https://clerk.com/docs/guides/sessions/session-tokens)
- [Clerk Playwright testing](https://clerk.com/docs/guides/development/testing/playwright/overview)
- Bundled Next.js authentication/DAL, proxy and Playwright guides for installed Next.js 16.4.3.

## Reproduce checks

`npm run test:unit` tests the role matrix and signed verification-age validation.

`npm run test:integration` tests actual Convex function registrations against an isolated in-memory Convex database with fictional identities, allowed/denied scope, permission removal, audit and retries.

`npm run build` uses Next.js's supported Webpack production builder. A clean build succeeds; Turbopack's PostCSS process could not bind its internal port in this environment. The prior Webpack error disappeared after moving the old generated `.next` cache to a recoverable temporary directory.

`npm run test:e2e` runs the existing suite and added anonymous route-denial checks against the production build. A failure remains a failed phase gate; do not skip it or claim that unit tests substitute for a live browser workflow.
