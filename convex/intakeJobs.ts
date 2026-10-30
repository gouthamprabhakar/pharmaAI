"use node";

import { v } from "convex/values";
import ExcelJS from "exceljs";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { parseWorkbook, MAX_ROWS } from "./lib/parseWorkbook";
import { canonicalJson } from "./lib/contracts";

export const process = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args): Promise<void> => {
    const context = await ctx.runMutation(internal.intake.claimJob, args); if (!context) return;
    try {
      if (!context.url) throw new Error("FILE_MISSING");
      const response = await fetch(context.url, { signal: AbortSignal.timeout(30_000), redirect: "error" }); if (!response.ok) throw new Error("FILE_UNAVAILABLE");
      const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length !== context.file.sizeBytes || bytes.length > 5 * 1024 * 1024) throw new Error("FILE_LIMIT");
      const allRows = await parseWorkbook(bytes, context.file.fileName); let [headers, ...rows] = allRows;
      if (context.mapping) {
        if (canonicalJson(headers) !== canonicalJson(context.mapping.sourceHeaders) || !context.templateVersion) throw new Error("LEGACY_MAPPING_HEADERS_MISMATCH");
        headers = ["template_version", ...context.mapping.targetHeaders]; rows = rows.map((row) => [String(context.templateVersion), ...row]);
      }
      if (!headers?.length || !rows.length || rows.length > MAX_ROWS || new Set(headers).size !== headers.length || headers.some((h) => !/^[a-z_]+$/.test(h))) throw new Error("INVALID_HEADERS_OR_EMPTY_FILE");
      for (let start = 0; start < rows.length; start += 100) {
        const chunk = rows.slice(start, start + 100).map((row) => { if (row.length > headers.length && row.slice(headers.length).some(Boolean)) throw new Error("COLUMN_COUNT_MISMATCH"); return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])); });
        await ctx.runMutation(internal.intake.writeRows, { jobId: args.jobId, start, rows: chunk });
      }
      await ctx.runMutation(internal.intake.finishValidation, { jobId: args.jobId, rowCount: rows.length });
    } catch (error) {
      const e = error as { data?: { code?: string }; message?: string };
      const message = e?.data?.code ?? e?.message ?? "";
      const code = message === "ACCESS_DENIED" ? "PERMISSION_CHANGED" : /^[A-Z_]{3,80}$/.test(message) ? message : "PROCESSING_FAILED";
      await ctx.runMutation(internal.intake.failJob, { jobId: args.jobId, code, transient: code === "FILE_UNAVAILABLE" });
    }
  },
});
export const downloadTemplate = action({
  args: { templateId: v.id("templates"), format: v.union(v.literal("xlsx"), v.literal("csv")) },
  handler: async (ctx, args): Promise<{ fileName: string; contentType: string; base64: string }> => {
    const template = await ctx.runQuery(api.intake.templateForDownload, { templateId: args.templateId });
    const headers = ["template_version", ...template.columns.required, ...template.columns.optional];
    const fileName = `${template.evidenceType}-v${template.version}.${args.format}`;
    if (args.format === "csv") return { fileName, contentType: "text/csv", base64: Buffer.from(`${headers.join(",")}\r\n`).toString("base64") };
    const workbook = new ExcelJS.Workbook(); workbook.creator = "PharmaAI"; workbook.created = new Date(template.createdAt); workbook.modified = new Date(template.createdAt);
    const sheet = workbook.addWorksheet("Data"); sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(36, Math.max(18, header.length + 2)), style: { numFmt: "@" } })); sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    const instructions = workbook.addWorksheet("Instructions"); instructions.getColumn(1).width = 110;
    for (const value of [`Evidence type: ${template.evidenceType}`, `Template version: ${template.version}. Enter this value in template_version for every record.`, "Enter dates as YYYY-MM-DD. Enter quantities, INR amounts and rates as exact decimal text.", "Use configured unit, distributor and product codes and the product's configured quantity unit.", "Use zero for a required movement that did not occur. Do not leave required cells blank.", "Do not add formulas, macros, patient data or other sheets. Limit: 1,000 records and 5 MiB.", "Upload and validate, review warnings/corrections, then explicitly confirm usable records.", "A validated import is not an approved return, issued credit or inventory adjustment."]) instructions.addRow([value]);
    const bytes = await workbook.xlsx.writeBuffer(); return { fileName, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: Buffer.from(bytes).toString("base64") };
  },
});
