import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { caseAccess } from "./lib/caseAccess";
import { deny } from "./lib/authorization";
import { internalActor } from "./lib/internalActor";
import { operation } from "./lib/operations";
import { integer, invalid, text } from "./lib/contracts";
import { businessAudit } from "./lib/businessAudit";

export const requestUpload = mutation({
  args: { caseId: v.id("returnCases"), fileName: v.string(), contentType: v.string(), sizeBytes: v.number(), noPatientData: v.boolean(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await caseAccess(ctx, args.caseId); const providedBy = actor.membership.role === "distributor" ? "distributor" as const : "manufacturer" as const; await caseAccess(ctx, args.caseId, providedBy === "distributor" ? "return_submit" : "receipt");
    if (!args.noPatientData || !["image/jpeg", "image/png", "application/pdf"].includes(args.contentType) || !/\.(png|jpe?g|pdf)$/i.test(args.fileName)) return invalid("SUPPORTED_EVIDENCE_REQUIRED"); integer(args.sizeBytes, 1, 5 * 1024 * 1024); const fileName = text(args.fileName, 160); if (/[\\/]/.test(fileName)) return invalid("INVALID_FILE_NAME");
    const op = await operation(ctx, actor.item.organizationId, actor.user._id, args.idempotencyKey, { action: "case_document", ...args, idempotencyKey: undefined });
    const id = op.priorId ? ctx.db.normalizeId("documentIntents", op.priorId) : await ctx.db.insert("documentIntents", { organizationId: actor.item.organizationId, operationalUnitId: actor.item.operationalUnitId!, distributorId: actor.item.distributorId, caseId: args.caseId, fileName, contentType: args.contentType, sizeBytes: args.sizeBytes, actorUserId: actor.user._id, providedBy, createdAt: Date.now(), expiresAt: Date.now() + 3600000 });
    if (!id) return invalid(); if (!op.priorId) await op.complete(id); const intent = await ctx.db.get(id); if (!intent || intent.actorUserId !== actor.user._id || intent.expiresAt < Date.now()) return invalid("UPLOAD_EXPIRED");
    return { intentId: id, documentId: intent.documentId, uploadUrl: intent.documentId ? null : await ctx.storage.generateUploadUrl() };
  },
});
export const completeUpload = mutation({
  args: { intentId: v.id("documentIntents"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId); if (!intent) return deny(); const actor = await caseAccess(ctx, intent.caseId, intent.providedBy === "distributor" ? "return_submit" : "receipt"); if (intent.actorUserId !== actor.user._id) return deny(); if (intent.documentId) return intent.documentId; if (intent.expiresAt < Date.now()) return invalid("UPLOAD_EXPIRED");
    const metadata = await ctx.db.system.get(args.storageId); if (!metadata || metadata.size !== intent.sizeBytes || metadata.contentType !== intent.contentType) return invalid("FILE_METADATA_MISMATCH");
    if (await ctx.db.query("documents").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).unique() || await ctx.db.query("evidenceFiles").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).unique()) return invalid("FILE_ALREADY_CLAIMED");
    const previous = (await ctx.db.query("documents").withIndex("by_case", (q) => q.eq("caseId", intent.caseId)).collect()).find((d) => d.sha256 === metadata.sha256 && d.providedBy === intent.providedBy);
    if (previous) { await ctx.storage.delete(args.storageId); await ctx.db.patch(intent._id, { documentId: previous._id }); return previous._id; }
    const id = await ctx.db.insert("documents", { organizationId: intent.organizationId, operationalUnitId: intent.operationalUnitId, distributorId: intent.distributorId, caseId: intent.caseId, storageId: args.storageId, fileName: intent.fileName, contentType: intent.contentType, sizeBytes: intent.sizeBytes, sha256: metadata.sha256, uploadedBy: actor.user._id, workerActorId: actor.user._id, providedBy: intent.providedBy, status: "quarantined", createdAt: Date.now() });
    await ctx.db.patch(intent._id, { documentId: id }); await businessAudit(ctx, intent.organizationId, actor.user._id, "return_case", intent.caseId, "document.quarantined", "Evidence uploaded; scanning and prohibited-data screening are required before access or extraction"); await ctx.scheduler.runAfter(0, internal.documentJobs.scan, { documentId: id }); return id;
  },
});
export const list = query({
  args: { caseId: v.id("returnCases") },
  handler: async (ctx, args) => { const actor = await caseAccess(ctx, args.caseId); return (await ctx.db.query("documents").withIndex("by_case", (q) => q.eq("caseId", args.caseId)).collect()).filter((d) => actor.membership.role !== "distributor" || d.providedBy === "distributor").map((d) => ({ id: d._id, fileName: d.fileName, contentType: d.contentType, status: d.status, providedBy: d.providedBy, errorCode: d.errorCode })); },
});
export const retry = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => { const doc = await ctx.db.get(args.documentId); if (!doc) return deny(); const actor = await caseAccess(ctx, doc.caseId, doc.providedBy === "distributor" ? "return_submit" : "receipt"); if (doc.status === "unsafe" || doc.status === "clean" || doc.status === "scanning" && (doc.leaseUntil ?? 0) > Date.now()) return invalid("DOCUMENT_NOT_RETRYABLE"); await ctx.db.patch(doc._id, { workerActorId: actor.user._id, status: "quarantined", errorCode: undefined }); await ctx.scheduler.runAfter(0, internal.documentJobs.scan, args); return doc._id; },
});
export const claim = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => { const doc = await ctx.db.get(args.documentId); if (!doc || ["clean", "unsafe"].includes(doc.status) || doc.status === "scanning" && (doc.leaseUntil ?? 0) > Date.now()) return null; await internalActor(ctx, doc, doc.workerActorId, doc.providedBy === "distributor" ? "return_submit" : "receipt"); await ctx.db.patch(doc._id, { status: "scanning", leaseUntil: Date.now() + 120000 }); return { doc, url: await ctx.storage.getUrl(doc.storageId) }; },
});
export const recordCheck = internalMutation({
  args: { documentId: v.id("documents"), sha256: v.string(), verdict: v.union(v.literal("clean"), v.literal("unsafe")), patientDataDetected: v.boolean(), engine: v.string(), engineVersion: v.string() },
  handler: async (ctx, args) => { const doc = await ctx.db.get(args.documentId); if (!doc) return deny(); await internalActor(ctx, doc, doc.workerActorId, doc.providedBy === "distributor" ? "return_submit" : "receipt"); if (doc.sha256 !== args.sha256) return invalid("CHECKSUM_MISMATCH"); if (doc.status === "clean" || doc.status === "unsafe") return; await ctx.db.insert("documentChecks", { organizationId: doc.organizationId, ...args, createdAt: Date.now() }); const clean = args.verdict === "clean" && !args.patientDataDetected; if (!clean) await ctx.storage.delete(doc.storageId); await ctx.db.patch(doc._id, { status: clean ? "clean" : "unsafe", leaseUntil: undefined, errorCode: clean ? undefined : "UNSAFE_OR_PROHIBITED_FILE" }); await businessAudit(ctx, doc.organizationId, doc.workerActorId, "return_case", doc.caseId, clean ? "document.checked" : "document.rejected", clean ? "Verified scan and prohibited-data checks passed" : "Unsafe or prohibited evidence removed from quarantine"); },
});
export const fail = internalMutation({
  args: { documentId: v.id("documents"), code: v.string() },
  handler: async (ctx, args) => { const doc = await ctx.db.get(args.documentId); if (doc && !["clean", "unsafe"].includes(doc.status)) await ctx.db.patch(doc._id, { status: "blocked", errorCode: text(args.code, 80), leaseUntil: undefined }); },
});
export const download = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => { const doc = await ctx.db.get(args.documentId); if (!doc || doc.status !== "clean") return deny(); const actor = await caseAccess(ctx, doc.caseId); if (actor.membership.role === "distributor" && doc.providedBy !== "distributor") return deny(); return { url: await ctx.storage.getUrl(doc.storageId), fileName: doc.fileName, contentType: doc.contentType }; },
});
