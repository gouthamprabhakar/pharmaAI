"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { scanFile } from "./lib/fileScanner";
export const scan = internalAction({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args): Promise<void> => {
    try { const context = await ctx.runMutation(internal.documents.claim, args); if (!context) return;
      if (!process.env.FILE_SCAN_URL || !process.env.FILE_SCAN_API_KEY) throw new Error("SCAN_NOT_CONFIGURED"); if (!context.url) throw new Error("FILE_MISSING"); const response = await fetch(context.url, { signal: AbortSignal.timeout(30000) }); if (!response.ok) throw new Error("FILE_UNAVAILABLE"); const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length !== context.doc.sizeBytes || bytes.length > 5 * 1024 * 1024) throw new Error("FILE_LIMIT");
      const valid = context.doc.contentType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : context.doc.contentType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 5).toString("ascii") === "%PDF-"; if (!valid) throw new Error("UNSUPPORTED_EVIDENCE_CONTENT");
      await ctx.runMutation(internal.documents.recordCheck, { ...args, ...await scanFile(bytes, context.doc.fileName) });
    } catch (error) { const e = error as { data?: { code?: string }; message?: string }; const code = e?.data?.code ?? e?.message ?? ""; await ctx.runMutation(internal.documents.fail, { ...args, code: /^[A-Z_]{3,80}$/.test(code) ? code : "DOCUMENT_PROCESSING_FAILED" }); }
  },
});
