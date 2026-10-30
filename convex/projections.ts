import { v } from "convex/values";
import { mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { deny } from "./lib/authorization";
import { submissionAccess, jobAccess } from "./lib/intakeAccess";
import { operation } from "./lib/operations";
import { businessAudit } from "./lib/businessAudit";

export const retry = mutation({
  args: { submissionId: v.id("submissions"), idempotencyKey: v.string() },
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted") return deny(); const actor = await submissionAccess(ctx, s, true); const op = await operation(ctx, s.organizationId, actor.user._id, args.idempotencyKey, { action: "link_workflow", submissionId: s._id }); if (op.priorId) return op.priorId; await ctx.scheduler.runAfter(0, internal.projections.begin, { submissionId: s._id, actorUserId: actor.user._id, force: true }); return op.complete(s._id); },
});
export const begin = internalMutation({
  args: { submissionId: v.id("submissions"), actorUserId: v.id("users"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || (s.projectionState === "completed" && !args.force)) return; await jobAccess(ctx, { ...s, submittedBy: args.actorUserId }); await ctx.db.patch(s._id, { projectionState: "queued", projectionActorId: args.actorUserId, projectionCursor: 0, projectionErrorCode: undefined }); await ctx.scheduler.runAfter(0, internal.projections.process, { submissionId: s._id }); },
});
export const context = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s || s.status !== "accepted" || !s.projectionActorId || s.projectionState === "completed") return null; await jobAccess(ctx, { ...s, submittedBy: s.projectionActorId }); return { type: s.evidenceType, actorUserId: s.projectionActorId, cursor: s.projectionCursor ?? 0 }; },
});
export const mark = internalMutation({
  args: { submissionId: v.id("submissions"), state: v.union(v.literal("processing"), v.literal("completed"), v.literal("blocked")), cursor: v.number(), errorCode: v.optional(v.string()) },
  handler: async (ctx, args) => { const s = await ctx.db.get(args.submissionId); if (!s || s.projectionState === "completed") return; await ctx.db.patch(s._id, { projectionState: args.state, projectionCursor: Math.max(s.projectionCursor ?? 0, args.cursor), projectionErrorCode: args.errorCode }); if (args.state === "completed") { await ctx.scheduler.runAfter(0, internal.refresh.sources, { submissionId: s._id, kind: "returns" }); await ctx.scheduler.runAfter(0, internal.refresh.sources, { submissionId: s._id, kind: "stock" }); } if (args.state === "completed" && s.projectionActorId) await businessAudit(ctx, s.organizationId, s.projectionActorId, "submission", s._id, "intake.workflow_linked", "Accepted normalized evidence linked to the owning workflow"); },
});
export const process = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<void> => {
    try {
      const job = await ctx.runQuery(internal.projections.context, args); if (!job) return;
      await ctx.runMutation(internal.projections.mark, { ...args, state: "processing", cursor: job.cursor });
      const input = { ...args, actorUserId: job.actorUserId, cursor: job.cursor };
      let result: { done: boolean; cursor: number } | undefined;
      if (job.type === "manufacturer_sales_shipments") result = await ctx.runMutation(internal.manufacturer.projectSubmission, input);
      else if (job.type === "distributor_return_claim") result = await ctx.runMutation(internal.returns.projectSubmission, input);
      else if (job.type === "issued_credit_notes") result = await ctx.runMutation(internal.credits.projectSubmission, input);
      else if (job.type === "distributor_sales_stock") result = await ctx.runMutation(internal.stock.projectSubmission, input);
      if (!result) throw new Error("WORKFLOW_LINKING_FAILED");
      await ctx.runMutation(internal.projections.mark, { ...args, state: result.done ? "completed" : "processing", cursor: result.cursor });
      if (!result.done) await ctx.scheduler.runAfter(0, internal.projections.process, args);
    } catch (error) { const e = error as { data?: { code?: string }; message?: string }; const value = e?.data?.code ?? e?.message ?? ""; const errorCode = value === "ACCESS_DENIED" ? "PERMISSION_CHANGED" : /^[A-Z_]{3,80}$/.test(value) ? value : "WORKFLOW_LINKING_FAILED"; await ctx.runMutation(internal.projections.mark, { ...args, state: "blocked", cursor: 0, errorCode }); }
  },
});
