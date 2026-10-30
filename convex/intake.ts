import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { evidenceType } from "./configurationSchema";
import { deny, permitsDistributor, permitsUnit, requireAccess } from "./lib/authorization";
import { intakeCapability, jobAccess, submissionAccess } from "./lib/intakeAccess";
import { canonicalJson, date, integer, invalid, selectEffective, text } from "./lib/contracts";
import { operation } from "./lib/operations";
import { normalizeRow, type NormalizedRow } from "./lib/normalizeRow";
import { templateCatalog } from "./lib/templateCatalog";
import { allowedIntakeTypes } from "./lib/intakePermissions";

const org = { organizationId: v.id("organizations") };
const submissionArgs = { submissionId: v.id("submissions") };
export const mappings = query({
  args: { ...org, operationalUnitId: v.id("operationalUnits"), distributorId: v.optional(v.id("distributors")), evidenceType },
  handler: async (ctx, args) => { const actor = await requireAccess(ctx, args); if (!allowedIntakeTypes(actor.membership.role).includes(args.evidenceType) || (actor.membership.role === "distributor" && args.distributorId !== actor.membership.distributorId)) return []; return (await ctx.db.query("importMappings").withIndex("by_scope", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("evidenceType", args.evidenceType)).collect()).filter((m) => m.distributorId === args.distributorId); },
});
export const saveMapping = mutation({
  args: { ...org, operationalUnitId: v.id("operationalUnits"), distributorId: v.optional(v.id("distributors")), evidenceType, sourceHeaders: v.array(v.string()), targetHeaders: v.array(v.string()), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args, "configure"); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED");
    const allowed: readonly string[] = [...templateCatalog[args.evidenceType].required, ...templateCatalog[args.evidenceType].optional];
    if (!args.sourceHeaders.length || args.sourceHeaders.length > 40 || args.sourceHeaders.length !== args.targetHeaders.length || args.sourceHeaders.some((h) => text(h, 80) !== h) || new Set(args.sourceHeaders).size !== args.sourceHeaders.length || new Set(args.targetHeaders).size !== args.targetHeaders.length || args.targetHeaders.some((h) => !allowed.includes(h)) || templateCatalog[args.evidenceType].required.some((h) => !args.targetHeaders.includes(h))) return invalid("INVALID_MAPPING");
    const op = await operation(ctx, args.organizationId, actor.user._id, args.idempotencyKey, { action: "legacy_mapping", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    const previous = await ctx.db.query("importMappings").withIndex("by_scope", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("evidenceType", args.evidenceType)).collect();
    const id = await ctx.db.insert("importMappings", { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, distributorId: args.distributorId, evidenceType: args.evidenceType, sourceHeaders: args.sourceHeaders, targetHeaders: args.targetHeaders, version: previous.length + 1, createdBy: actor.user._id, reason, createdAt: Date.now() }); await ctx.db.insert("auditEvents", { organizationId: args.organizationId, actorUserId: actor.user._id, targetType: "import_mapping", targetId: id, action: "mapping.approved", reason, afterJson: canonicalJson({ sourceHeaders: args.sourceHeaders, targetHeaders: args.targetHeaders }), createdAt: Date.now() }); return op.complete(id);
  },
});
const errorCode = (error: unknown) => { const e = error as { data?: { code?: unknown }; message?: string }; const value = e?.data?.code ?? e?.message; return typeof value === "string" && /^[A-Z_]{3,80}$/.test(value) ? value : "INVALID_ROW"; };
async function latestRows(ctx: Pick<QueryCtx, "db">, id: Id<"submissions">) { const all = await ctx.db.query("importRows").withIndex("by_submission_row", (q) => q.eq("submissionId", id)).take(5001); if (all.length > 5000) return invalid("ROW_REVISION_LIMIT"); const rows = new Map<number, Doc<"importRows">>(); for (const row of all) { const previous = rows.get(row.rowNumber); if (!previous || row.revision > previous.revision) rows.set(row.rowNumber, row); } return [...rows.values()]; }
async function intakeAudit(ctx: MutationCtx, s: Doc<"submissions">, actor: Id<"users">, action: string, reason: string) { await ctx.db.insert("auditEvents", { organizationId: s.organizationId, actorUserId: actor, targetType: "submission", targetId: s._id, action, reason, createdAt: Date.now() }); }

export const templates = query({
  args: { ...org, operationalUnitId: v.id("operationalUnits") },
  handler: async (ctx, args) => { const actor = await requireAccess(ctx, args); const rows = await ctx.db.query("templates").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect(); return rows.filter((t) => t.operationalUnitId === args.operationalUnitId && allowedIntakeTypes(actor.membership.role).includes(t.evidenceType)).map((t) => ({ id: t._id, evidenceType: t.evidenceType, version: t.version, effectiveFrom: t.effectiveFrom, columns: JSON.parse(t.columnsJson) as { required: string[]; optional: string[] } })); },
});
export const templateForDownload = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => { const template = await ctx.db.get(args.templateId); if (!template) return deny(); const actor = await requireAccess(ctx, template); if (!allowedIntakeTypes(actor.membership.role).includes(template.evidenceType)) return deny(); return { evidenceType: template.evidenceType, version: template.version, createdAt: template.createdAt, columns: JSON.parse(template.columnsJson) as { required: string[]; optional: string[] } }; },
});
export const requestUpload = mutation({
  args: { ...org, operationalUnitId: v.id("operationalUnits"), distributorId: v.optional(v.id("distributors")), evidenceType, templateId: v.id("templates"), mappingId: v.optional(v.id("importMappings")), fileName: v.string(), contentType: v.string(), sizeBytes: v.number(), periodStart: v.string(), periodEnd: v.string(), supersedesId: v.optional(v.id("submissions")), noPatientData: v.boolean(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAccess(ctx, args); await requireAccess(ctx, args, intakeCapability(args.evidenceType, actor.membership.role));
    if (!args.noPatientData || ((args.evidenceType === "distributor_return_claim" || args.evidenceType === "distributor_sales_stock") && !args.distributorId)) return invalid("DISTRIBUTOR_AND_DECLARATION_REQUIRED");
    date(args.periodStart); date(args.periodEnd); if (args.periodStart > args.periodEnd) return invalid("INVALID_PERIOD");
    integer(args.sizeBytes, 1, 5 * 1024 * 1024); const name = text(args.fileName, 160); if (!/\.(csv|xlsx)$/i.test(name) || /[\\/]/.test(name)) return invalid("UNSUPPORTED_FILE");
    if (!["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"].includes(args.contentType)) return invalid("UNSUPPORTED_FILE");
    const template = await ctx.db.get(args.templateId); if (!template || template.organizationId !== args.organizationId || template.operationalUnitId !== args.operationalUnitId || template.evidenceType !== args.evidenceType) return invalid("TEMPLATE_REQUIRED");
    const applicable = selectEffective(await ctx.db.query("templates").withIndex("by_type", (q) => q.eq("organizationId", args.organizationId).eq("operationalUnitId", args.operationalUnitId).eq("evidenceType", args.evidenceType)).collect(), args.periodStart);
    if (applicable?._id !== args.templateId) return invalid("APPLICABLE_TEMPLATE_REQUIRED");
    if (args.mappingId) { const mapping = await ctx.db.get(args.mappingId); if (!mapping || mapping.organizationId !== args.organizationId || mapping.operationalUnitId !== args.operationalUnitId || mapping.distributorId !== args.distributorId || mapping.evidenceType !== args.evidenceType) return deny(); }
    if (args.supersedesId) { const previous = await ctx.db.get(args.supersedesId); if (!previous) return deny(); await submissionAccess(ctx, previous, true); if (previous.status !== "accepted" || previous.organizationId !== args.organizationId || previous.operationalUnitId !== args.operationalUnitId || previous.distributorId !== args.distributorId || previous.evidenceType !== args.evidenceType || previous.periodStart !== args.periodStart || previous.periodEnd !== args.periodEnd) return invalid("INVALID_CORRECTION_SOURCE"); }
    const op = await operation(ctx, args.organizationId, actor.user._id, args.idempotencyKey, { action: "upload", ...args, idempotencyKey: undefined });
    let intentId = op.priorId as Id<"uploadIntents"> | undefined;
    if (!intentId) { intentId = await ctx.db.insert("uploadIntents", { organizationId: args.organizationId, operationalUnitId: args.operationalUnitId, distributorId: args.distributorId, evidenceType: args.evidenceType, templateId: args.templateId, mappingId: args.mappingId, fileName: name, contentType: args.contentType, sizeBytes: args.sizeBytes, periodStart: args.periodStart, periodEnd: args.periodEnd, actorUserId: actor.user._id, createdAt: Date.now(), expiresAt: Date.now() + 3600000, supersedesId: args.supersedesId }); await op.complete(intentId); }
    const intent = await ctx.db.get(intentId); if (!intent || intent.actorUserId !== actor.user._id || intent.expiresAt < Date.now()) return invalid("UPLOAD_EXPIRED");
    return { intentId, submissionId: intent.submissionId, uploadUrl: intent.submissionId ? null : await ctx.storage.generateUploadUrl() };
  },
});
export const completeUpload = mutation({
  args: { intentId: v.id("uploadIntents"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId); if (!intent) return deny(); const actor = await requireAccess(ctx, intent); await requireAccess(ctx, intent, intakeCapability(intent.evidenceType, actor.membership.role)); if (intent.actorUserId !== actor.user._id) return deny();
    if (intent.submissionId) return intent.submissionId; if (intent.expiresAt < Date.now()) return invalid("UPLOAD_EXPIRED");
    const metadata = await ctx.db.system.get(args.storageId); if (!metadata || metadata.size !== intent.sizeBytes || metadata.size > 5 * 1024 * 1024) return invalid("FILE_METADATA_MISMATCH");
    if (await ctx.db.query("evidenceFiles").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).unique()) return invalid("FILE_ALREADY_CLAIMED");
    const existing = await ctx.db.query("submissions").withIndex("by_organization_checksum", (q) => q.eq("organizationId", intent.organizationId).eq("sha256", metadata.sha256)).collect();
    const duplicate = existing.find((s) => s.operationalUnitId === intent.operationalUnitId && s.distributorId === intent.distributorId && s.evidenceType === intent.evidenceType && s.periodStart === intent.periodStart && s.periodEnd === intent.periodEnd);
    if (duplicate) { await submissionAccess(ctx, duplicate, true); await ctx.storage.delete(args.storageId); await ctx.db.patch(intent._id, { submissionId: duplicate._id }); return duplicate._id; }
    const submissionId = await ctx.db.insert("submissions", { organizationId: intent.organizationId, operationalUnitId: intent.operationalUnitId, distributorId: intent.distributorId, evidenceType: intent.evidenceType, periodStart: intent.periodStart, periodEnd: intent.periodEnd, status: "received", submittedBy: actor.user._id, createdAt: Date.now(), fileName: intent.fileName, sha256: metadata.sha256, templateId: intent.templateId, mappingId: intent.mappingId, supersedesId: intent.supersedesId });
    await ctx.db.insert("evidenceFiles", { organizationId: intent.organizationId, submissionId, storageId: args.storageId, fileName: intent.fileName, contentType: metadata.contentType ?? intent.contentType, sizeBytes: metadata.size, sha256: metadata.sha256, uploadedBy: actor.user._id, createdAt: Date.now() });
    const jobId = await ctx.db.insert("jobs", { organizationId: intent.organizationId, operationalUnitId: intent.operationalUnitId, distributorId: intent.distributorId, submissionId, actorUserId: actor.user._id, kind: "intake", status: "queued", stage: "security_scan", attempts: 0, createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.patch(submissionId, { jobId }); await ctx.db.patch(intent._id, { submissionId }); const submission = await ctx.db.get(submissionId); if (!submission) return deny(); await intakeAudit(ctx, submission, actor.user._id, "intake.uploaded", "Original file quarantined pending security checks"); await ctx.scheduler.runAfter(0, internal.intakeJobs.process, { jobId }); return submissionId;
  },
});
export const history = query({
  args: org,
  handler: async (ctx, args) => { const actor = await requireAccess(ctx, args); const units = (await ctx.db.query("operationalUnits").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect()).filter((u) => u.active && permitsUnit(actor.membership, u._id)); if (!units.length) return []; const rows = await ctx.db.query("submissions").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).filter((q) => q.and(q.or(...units.map((u) => q.eq(q.field("operationalUnitId"), u._id))), actor.membership.role === "distributor" ? q.eq(q.field("distributorId"), actor.membership.distributorId) : q.eq(true, true))).order("desc").take(1000); const result = []; for (const s of rows) { if (!permitsUnit(actor.membership, s.operationalUnitId) || (actor.membership.role === "distributor" && (!s.distributorId || !permitsDistributor(actor.membership, s.distributorId)))) continue; try { await submissionAccess(ctx, s); result.push({ ...s, job: s.jobId ? await ctx.db.get(s.jobId) : null }); } catch { /* Removed scope stays absent. */ } } return result; },
});
export const detail = query({
  args: submissionArgs,
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s) return deny(); const actor = await submissionAccess(ctx, s); const rows = await latestRows(ctx, s._id); const checks = await ctx.db.query("fileChecks").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect(); return { submission: s, rows, checks, canWrite: allowedIntakeTypes(actor.membership.role).includes(s.evidenceType), job: s.jobId ? await ctx.db.get(s.jobId) : null, canDownload: checks.some((c) => c.verdict === "clean" && !c.patientDataDetected) }; },
});
export const retry = mutation({
  args: submissionArgs,
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s || !s.jobId) return deny(); const actor = await submissionAccess(ctx, s, true); const job = await ctx.db.get(s.jobId); if (!job || !["blocked", "failed"].includes(job.status)) return invalid("JOB_NOT_RETRYABLE"); if (["accepted", "replaced", "confirming"].includes(s.status)) return invalid("ALREADY_CONFIRMED"); await ctx.db.patch(job._id, { actorUserId: actor.user._id, status: "queued", attempts: 0, errorCode: undefined, updatedAt: Date.now() }); await intakeAudit(ctx, s, actor.user._id, "intake.retry", "Authorized retry of the same import job"); await ctx.scheduler.runAfter(0, internal.intakeJobs.process, { jobId: job._id }); return job._id; },
});
export const correctRow = mutation({
  args: { ...submissionArgs, rowNumber: v.number(), values: v.record(v.string(), v.string()), exclude: v.boolean(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s) return deny(); const actor = await submissionAccess(ctx, s, true); if (!["ready_for_confirmation", "correction_required"].includes(s.status)) return invalid("CORRECTION_NOT_ALLOWED"); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED");
    const op = await operation(ctx, s.organizationId, actor.user._id, args.idempotencyKey, { action: "row_correction", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    const previous = (await latestRows(ctx, s._id)).find((r) => r.rowNumber === args.rowNumber); if (!previous) return invalid("ROW_NOT_FOUND");
    let next: { status: "valid" | "warning" | "invalid" | "excluded"; errors: string[]; normalizedJson?: string; fingerprint?: string; values?: Record<string, string> } = { status: "excluded", errors: [] };
    if (!args.exclude) { try { const result = await normalizeRow(ctx, { ...s, submittedBy: actor.user._id }, args.values); next = { status: result.warnings.length ? "warning" : "valid", errors: result.warnings, normalizedJson: canonicalJson(result.row), fingerprint: result.fingerprint, values: result.row.values }; } catch (error) { next = { status: "invalid", errors: [errorCode(error)] }; } }
    const id = await ctx.db.insert("importRows", { organizationId: s.organizationId, submissionId: s._id, rowNumber: args.rowNumber, revision: previous.revision + 1, ...next, createdBy: actor.user._id, reason, createdAt: Date.now() }); await intakeAudit(ctx, s, actor.user._id, "intake.row_corrected", reason); const rows = await latestRows(ctx, s._id); await ctx.db.patch(s._id, { status: rows.some((r) => r.status === "invalid") ? "correction_required" : "ready_for_confirmation" }); return op.complete(id);
  },
});
export const confirm = mutation({
  args: { ...submissionArgs, acceptWarnings: v.boolean(), allowPartial: v.boolean(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s || !s.jobId) return deny(); const actor = await submissionAccess(ctx, s, true); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED"); const op = await operation(ctx, s.organizationId, actor.user._id, args.idempotencyKey, { action: "confirm", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId;
    if (!["ready_for_confirmation", "correction_required"].includes(s.status)) return invalid("IMPORT_NOT_READY"); const checks = await ctx.db.query("fileChecks").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect(); if (!checks.some((c) => c.verdict === "clean" && !c.patientDataDetected && c.sha256 === s.sha256)) return invalid("CLEAN_SCAN_REQUIRED");
    const rows = await latestRows(ctx, s._id); if (!args.allowPartial && rows.some((r) => r.status === "invalid")) return invalid("INVALID_ROWS_REMAIN"); if (!args.acceptWarnings && rows.some((r) => r.status === "warning")) return invalid("CONFIRM_WARNINGS_REQUIRED"); const selected = rows.filter((r) => ["valid", "warning"].includes(r.status)); if (!selected.length) return invalid("NO_USABLE_ROWS"); if (new Set(selected.map((r) => r.fingerprint)).size !== selected.length) return invalid("DUPLICATE_ROWS");
    await ctx.db.patch(s._id, { status: "confirming", acceptedRowIds: selected.map((r) => r._id) }); await ctx.db.patch(s.jobId, { actorUserId: actor.user._id, status: "processing", stage: "confirming", updatedAt: Date.now() }); await intakeAudit(ctx, s, actor.user._id, "intake.confirm_requested", reason); await ctx.scheduler.runAfter(0, internal.intake.materialize, { submissionId: s._id, cursor: 0 }); return op.complete(s._id);
  },
});
export const claimJob = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => { const job = await ctx.db.get(args.jobId); if (!job || job.stage === "confirming" || (job.status === "processing" && (job.leaseUntil ?? 0) > Date.now()) || job.status === "completed") return null; const submission = await ctx.db.get(job.submissionId); if (!submission || ["accepted", "replaced"].includes(submission.status)) return null; try { await jobAccess(ctx, { ...submission, submittedBy: job.actorUserId }); } catch { await ctx.db.patch(job._id, { status: "blocked", errorCode: "PERMISSION_CHANGED", updatedAt: Date.now() }); await ctx.db.patch(submission._id, { status: "blocked" }); return null; } const file = await ctx.db.query("evidenceFiles").withIndex("by_submission", (q) => q.eq("submissionId", submission._id)).unique(); if (!file) return invalid("FILE_MISSING"); await ctx.db.patch(job._id, { status: "processing", stage: "security_scan", attempts: job.attempts + 1, leaseUntil: Date.now() + 120000, updatedAt: Date.now() }); await ctx.db.patch(submission._id, { status: "validating" }); const checks = await ctx.db.query("fileChecks").withIndex("by_submission", (q) => q.eq("submissionId", submission._id)).collect(); const scan = checks.find((c) => c.sha256 === file.sha256 && c.verdict === "clean" && !c.patientDataDetected); const mapping = submission.mappingId ? await ctx.db.get(submission.mappingId) : null; const template = submission.templateId ? await ctx.db.get(submission.templateId) : null; return { job: { ...job, attempts: job.attempts + 1 }, submission, file, scan, mapping, templateVersion: template?.version, url: await ctx.storage.getUrl(file.storageId) }; },
});
export const cancelConfirmation = mutation({
  args: { ...submissionArgs, reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s || !s.jobId) return deny(); const actor = await submissionAccess(ctx, s, true); const reason = text(args.reason, 1000); if (reason.length < 3) return invalid("REASON_REQUIRED"); const op = await operation(ctx, s.organizationId, actor.user._id, args.idempotencyKey, { action: "cancel_confirmation", ...args, idempotencyKey: undefined }); if (op.priorId) return op.priorId; const job = await ctx.db.get(s.jobId); if (s.status !== "confirming" || !job || (job.status === "processing" && job.updatedAt > Date.now() - 120000)) return invalid("CONFIRMATION_STILL_RUNNING"); await ctx.db.patch(s._id, { status: "correction_required", acceptedRowIds: undefined }); await ctx.db.patch(job._id, { status: "completed", stage: "awaiting_confirmation", errorCode: undefined, updatedAt: Date.now() }); await intakeAudit(ctx, s, actor.user._id, "intake.confirmation_cancelled", reason); return op.complete(s._id); },
});
export const recordScan = internalMutation({
  args: { jobId: v.id("jobs"), sha256: v.string(), verdict: v.union(v.literal("clean"), v.literal("unsafe")), patientDataDetected: v.boolean(), engine: v.string(), engineVersion: v.string() },
  handler: async (ctx, args) => { const job = await ctx.db.get(args.jobId); if (!job) return deny(); const s = await ctx.db.get(job.submissionId); if (!s) return deny(); await jobAccess(ctx, { ...s, submittedBy: job.actorUserId }); if (args.sha256 !== s.sha256) return invalid("CHECKSUM_MISMATCH"); const previous = await ctx.db.query("fileChecks").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect(); if (!previous.some((c) => c.sha256 === args.sha256 && c.verdict === args.verdict && c.engineVersion === args.engineVersion)) await ctx.db.insert("fileChecks", { organizationId: s.organizationId, submissionId: s._id, sha256: args.sha256, verdict: args.verdict, patientDataDetected: args.patientDataDetected, engine: args.engine, engineVersion: args.engineVersion, createdAt: Date.now() }); if (args.verdict !== "clean" || args.patientDataDetected) { const file = await ctx.db.query("evidenceFiles").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).unique(); if (file) await ctx.storage.delete(file.storageId); await ctx.db.patch(s._id, { status: "failed" }); await ctx.db.patch(job._id, { status: "failed", stage: "security_scan", errorCode: "UNSAFE_OR_PROHIBITED_FILE", updatedAt: Date.now() }); await intakeAudit(ctx, s, job.actorUserId, "intake.file_rejected", "Unsafe or prohibited file removed from quarantine; metadata retained"); return false; } await ctx.db.patch(job._id, { stage: "parse_and_validate", updatedAt: Date.now() }); return true; },
});
export const writeRows = internalMutation({
  args: { jobId: v.id("jobs"), start: v.number(), rows: v.array(v.record(v.string(), v.string())) },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId); if (!job) return deny(); const s = await ctx.db.get(job.submissionId); if (!s) return deny(); await jobAccess(ctx, { ...s, submittedBy: job.actorUserId }); if (job.status !== "processing" || job.stage !== "parse_and_validate" || args.rows.length > 100) return invalid("JOB_STEP_INVALID"); const prior = await latestRows(ctx, s._id); const fingerprints = new Set(prior.map((r) => r.fingerprint));
    for (let index = 0; index < args.rows.length; index++) { const rowNumber = args.start + index + 2; if (prior.some((r) => r.rowNumber === rowNumber)) continue; let next: { status: "valid" | "warning" | "invalid"; errors: string[]; normalizedJson?: string; fingerprint?: string; values?: Record<string, string> };
      try { const result = await normalizeRow(ctx, { ...s, submittedBy: job.actorUserId }, args.rows[index]); if (fingerprints.has(result.fingerprint)) return invalid("DUPLICATE_ROWS"); fingerprints.add(result.fingerprint); next = { status: result.warnings.length ? "warning" : "valid", errors: result.warnings, normalizedJson: canonicalJson(result.row), fingerprint: result.fingerprint, values: result.row.values }; } catch (error) { next = { status: "invalid", errors: [errorCode(error)] }; }
      await ctx.db.insert("importRows", { organizationId: s.organizationId, submissionId: s._id, rowNumber, revision: 1, ...next, createdBy: job.actorUserId, reason: "Validated original record", createdAt: Date.now() });
    }
  },
});
export const finishValidation = internalMutation({
  args: { jobId: v.id("jobs"), rowCount: v.number() },
  handler: async (ctx, args) => { const job = await ctx.db.get(args.jobId); if (!job) return deny(); const s = await ctx.db.get(job.submissionId); if (!s) return deny(); await jobAccess(ctx, { ...s, submittedBy: job.actorUserId }); if (job.status === "completed") return; if (job.stage !== "parse_and_validate" || job.status !== "processing") return invalid("JOB_STEP_INVALID"); const rows = await latestRows(ctx, s._id); if (rows.length !== args.rowCount || !rows.length) return invalid("ROW_COUNT_MISMATCH"); await ctx.db.patch(s._id, { rowCount: rows.length, status: rows.some((r) => r.status === "invalid") ? "correction_required" : "ready_for_confirmation" }); await ctx.db.patch(job._id, { status: "completed", stage: "awaiting_confirmation", leaseUntil: undefined, updatedAt: Date.now() }); await intakeAudit(ctx, s, job.actorUserId, "intake.validated", "Structural validation completed; explicit human confirmation is required"); },
});
export const failJob = internalMutation({
  args: { jobId: v.id("jobs"), code: v.string(), transient: v.boolean() },
  handler: async (ctx, args) => { const job = await ctx.db.get(args.jobId); if (!job || job.status === "completed") return; const s = await ctx.db.get(job.submissionId); if (!s || ["accepted", "replaced"].includes(s.status)) return; const retry = args.transient && job.attempts < 3; await ctx.db.patch(job._id, { status: retry ? "queued" : ["SCAN_NOT_CONFIGURED", "PERMISSION_CHANGED"].includes(args.code) ? "blocked" : "failed", errorCode: text(args.code, 80), leaseUntil: undefined, updatedAt: Date.now() }); await ctx.db.patch(s._id, { status: retry ? "validating" : ["SCAN_NOT_CONFIGURED", "PERMISSION_CHANGED"].includes(args.code) ? "blocked" : "failed" }); if (retry) await ctx.scheduler.runAfter(2000 * 2 ** job.attempts, internal.intakeJobs.process, { jobId: job._id }); },
});
export const materialize = internalMutation({
  args: { ...submissionArgs, cursor: v.number() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "confirming" || !s.jobId) return; const job = await ctx.db.get(s.jobId); if (!job) return deny(); try { await jobAccess(ctx, { ...s, submittedBy: job.actorUserId }); } catch { await ctx.db.patch(job._id, { status: "blocked", errorCode: "PERMISSION_CHANGED", updatedAt: Date.now() }); return; }
    const selected = s.acceptedRowIds ?? []; const chunk = selected.slice(args.cursor, args.cursor + 50);
    for (const id of chunk) { const row = await ctx.db.get(id); if (!row?.normalizedJson || !row.fingerprint || row.submissionId !== s._id) return invalid("CONFIRMATION_SNAPSHOT_INVALID"); const normalized = JSON.parse(row.normalizedJson) as NormalizedRow; const previous = await ctx.db.query("confirmedRows").withIndex("by_fingerprint", (q) => q.eq("organizationId", s.organizationId).eq("fingerprint", row.fingerprint!)).order("desc").first(); if (previous?.importRowId === id) continue; if (previous && (previous.normalizedJson !== row.normalizedJson || s.supersedesId)) { if (previous.submissionId !== s.supersedesId && previous.submissionId !== s._id) { await ctx.db.patch(job._id, { status: "blocked", errorCode: "SOURCE_CONFLICT", updatedAt: Date.now() }); return; } } else if (previous) continue;
      await ctx.db.insert("confirmedRows", { organizationId: s.organizationId, operationalUnitId: s.operationalUnitId, distributorId: normalized.distributorId, submissionId: s._id, importRowId: id, evidenceType: s.evidenceType, fingerprint: row.fingerprint, normalizedJson: row.normalizedJson, revision: (previous?.revision ?? 0) + 1, supersedesId: previous?._id, createdBy: job.actorUserId, createdAt: Date.now() });
    }
    const cursor = args.cursor + chunk.length; if (cursor < selected.length) { await ctx.scheduler.runAfter(0, internal.intake.materialize, { submissionId: s._id, cursor }); return; }
    if (s.supersedesId) { const old = await ctx.db.get(s.supersedesId); if (old?.status === "accepted") await ctx.db.patch(old._id, { status: "replaced" }); }
    await ctx.db.patch(s._id, { status: "accepted", confirmedAt: Date.now() }); await ctx.db.patch(job._id, { status: "completed", stage: "confirmed", updatedAt: Date.now() }); await intakeAudit(ctx, s, job.actorUserId, "intake.confirmed", "Confirmed normalized records retained; original evidence and revisions preserved");
  },
});
export const download = internalQuery({
  args: submissionArgs,
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s) return deny(); await submissionAccess(ctx, s); const checks = await ctx.db.query("fileChecks").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).collect(); if (!checks.some((c) => c.verdict === "clean" && !c.patientDataDetected)) return deny(); const file = await ctx.db.query("evidenceFiles").withIndex("by_submission", (q) => q.eq("submissionId", s._id)).unique(); if (!file) return deny(); return { url: await ctx.storage.getUrl(file.storageId), fileName: file.fileName, contentType: file.contentType }; },
});
