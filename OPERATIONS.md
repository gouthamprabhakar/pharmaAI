# Development operations and release gates

## Current operating boundary

Use fictional information in the existing development Clerk/Convex projects. The frontend is `npm run dev` at localhost:3000; `npx convex dev` synchronizes backend changes. Production hosting, provider instances and client-data permission are not configured by this work.

## Recovery

- Check Administration > Security & privacy for configured-service indicators, the last hourly deadline check and blocked intake jobs. This is basic operational visibility, not an external monitoring or uptime guarantee.
- Retry a blocked file job from Data Intake only after correcting its provider/configuration/access problem. Original evidence, source rows and stable job identity are preserved.
- An accepted file can still have blocked workflow linking. Open its review and choose Retry workflow linking; do not re-upload to create duplicates.
- A source correction requires an explicit replacement submission and reason. Existing confirmed versions remain evidence. Recalculate dependent cases/variances and review changes before consequential decisions.
- Credit allocation corrections remain pending until Finance reconfirms the actual issued note total. Approval does not prove issuance.
- For an AI timeout/uncertain result, inspect the saved request. Do not automatically resubmit; it may already have incurred provider usage. Manual workflows remain available. Reservations are not provider invoice caps.
- If a person loses access, jobs recheck their current grants. An authorized person must resume affected work. Do not add a generic administrator bypass.

## Provider setup

Set secrets directly in local ignored environment files/provider dashboards. No secret values belong in source, logs, error messages, screenshots or chat. Automated upload malware/DLP scanning is not part of the current MVP; revisit it through `todo.md` only if production risk or a client assessment requires it. AI needs an approved model/key and organization budget controls. The Clerk receiver requires the real signing secret and external endpoint registration.

Hourly jobs check scoped credit/report deadlines and create in-app notifications. No external email/SMS/WhatsApp reminder service is enabled. Earlier than twelve-month missing-report periods require manual review; older tasks are retained. Do not confuse a scheduler heartbeat with every business workflow having passed.

## Before real client data

Resolve `todo.md` security/provider gates, manual acceptance and PLAN sections 24–25. Approve data residency, processing agreements, AI use, retention/deletion, backup/restore, alerting/support ownership and representative volumes. Obtain a demonstrated restore and supported-browser/security verification. Retention is pending: no automatic deletion of legitimate business evidence is enabled. Uploaders attest that files contain no patient-identifiable data; automated scanning is deferred.

Full tests are paused by user request, not waived for production. Do not label compilation or a successful development deployment as full MVP acceptance.
