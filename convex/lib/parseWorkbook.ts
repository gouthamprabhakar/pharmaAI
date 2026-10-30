"use node";

import ExcelJS from "exceljs";
import Decimal from "decimal.js";
import yauzl from "yauzl";
import { XMLParser } from "fast-xml-parser";
import { posix } from "node:path";

const fail = (code: string): never => { throw new Error(code); };
const ExactDecimal = Decimal.clone({ precision: 80, toExpNeg: -80, toExpPos: 80 });
function spreadsheetNumber(value: string) {
  const exact = new ExactDecimal(value);
  const rounded = exact.toDecimalPlaces(6);
  // Excel-compatible editors can serialize a displayed decimal with harmless
  // binary noise. Remove only sub-nanounit noise; meaningful extra precision
  // remains untouched and is rejected by the deterministic field validator.
  return exact.minus(rounded).abs().lte("0.000000001") ? rounded.toFixed() : value;
}
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 1000;
export function csvRows(input: string) {
  const result: string[][] = []; let row: string[] = []; let value = ""; let quoted = false; let closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) { if (c === '"') { if (input[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else value += c; }
    else if (c === '"' && value.length === 0 && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === "\r") { row.push(value.trim()); value = ""; closed = false; if (c !== ",") { if (c === "\r" && input[i + 1] === "\n") i++; if (row.some(Boolean)) result.push(row); row = []; } }
    else { if (closed || c === '"') return fail("INVALID_CSV"); value += c; }
    if (value.length > 160 || row.length > 40 || result.length > MAX_ROWS + 1) return fail("FILE_LIMIT");
  }
  if (quoted) return fail("INVALID_CSV"); row.push(value.trim()); if (row.some(Boolean)) result.push(row); return result;
}
async function inspectArchive(buffer: Buffer): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) { reject(new Error("INVALID_XLSX")); return; }
      let total = 0; let count = 0; const xml = new Map<string, string>(); let stopped = false;
      const stop = () => { if (!stopped) { stopped = true; zip.close(); reject(new Error("UNSAFE_XLSX")); } };
      zip.on("error", stop); zip.on("end", () => { if (!stopped) resolve(xml); });
      zip.on("entry", (entry: yauzl.Entry) => {
        if (++count > 2000 || entry.uncompressedSize > 20 * 1024 * 1024 || (entry.generalPurposeBitFlag & 1) || /vbaProject|externalLinks|embeddings|activex/i.test(entry.fileName)) { stop(); return; }
        if (entry.fileName.endsWith("/")) { zip.readEntry(); return; }
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) { stop(); return; }
          const keep = /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.fileName) || ["xl/workbook.xml", "xl/_rels/workbook.xml.rels"].includes(entry.fileName); const chunks: Buffer[] = [];
          stream.on("error", stop); stream.on("data", (chunk: Buffer) => { total += chunk.length; if (total > 20 * 1024 * 1024) { stream.destroy(); stop(); return; } if (keep) chunks.push(chunk); });
          stream.on("end", () => { if (stopped) return; if (keep) { const content = Buffer.concat(chunks).toString("utf8"); if (/<!DOCTYPE|<!ENTITY|<(?:\w+:)?f(?:\s|>)/i.test(content)) { stop(); return; } xml.set(entry.fileName, content); } zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}
export async function parseWorkbook(buffer: Buffer, fileName: string) {
  if (buffer.length > MAX_FILE_BYTES) return fail("FILE_LIMIT");
  if (fileName.toLowerCase().endsWith(".csv")) { if (buffer.includes(0)) return fail("INVALID_CSV"); return csvRows(new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "")); }
  if (!fileName.toLowerCase().endsWith(".xlsx") || buffer[0] !== 0x50 || buffer[1] !== 0x4b) return fail("UNSUPPORTED_FILE");
  const xml = await inspectArchive(buffer);
  // Read original numeric XML tokens, never quantities/rates through JS doubles.
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, processEntities: false, removeNSPrefix: true, isArray: (tag) => ["row", "c", "sheet", "Relationship"].includes(tag) });
  const numeric = new Map<string, string>();
  const book = parser.parse(xml.get("xl/workbook.xml") ?? "") as { workbook?: { sheets?: { sheet?: { "@_name": string; "@_id"?: string; "@_r:id"?: string }[] } } };
  const relationships = parser.parse(xml.get("xl/_rels/workbook.xml.rels") ?? "") as { Relationships?: { Relationship?: { "@_Id": string; "@_Target": string; "@_TargetMode"?: string }[] } };
  const dataSheet = book.workbook?.sheets?.sheet?.find((s) => s["@_name"] === "Data");
  const relationshipId = dataSheet?.["@_id"] ?? dataSheet?.["@_r:id"];
  const relationship = relationships.Relationships?.Relationship?.find((r) => r["@_Id"] === relationshipId);
  if (!relationship || relationship["@_TargetMode"] === "External") return fail("INVALID_XLSX");
  const target = relationship["@_Target"].startsWith("/") ? relationship["@_Target"].slice(1) : posix.normalize(`xl/${relationship["@_Target"]}`);
  if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(target)) return fail("INVALID_XLSX");
  const source = xml.get(target); if (!source) return fail("INVALID_XLSX");
  type ParsedCell = { "@_r"?: string; "@_t"?: string; v?: string; f?: unknown; is?: { t?: string } };
  const parsed = parser.parse(source) as { worksheet?: { sheetData?: { row?: { c?: ParsedCell[] }[] } } };
  for (const row of parsed.worksheet?.sheetData?.row ?? []) for (const cell of row.c ?? []) { if (cell.f !== undefined) return fail("FORMULA_NOT_ALLOWED"); if ((!cell["@_t"] || cell["@_t"] === "n") && typeof cell.v === "string" && cell["@_r"]) numeric.set(cell["@_r"], cell.v); }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    // Some controlled exporters emit a minimal, standards-compliant workbook
    // that Excel opens but ExcelJS cannot model. Read its plain Data cells from
    // the inspected XML; formulas and unsafe archive parts were already blocked.
    const columnNumber = (reference: string) => {
      const letters = reference.match(/^[A-Z]+/)?.[0]; if (!letters) return fail("INVALID_XLSX");
      return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
    };
    const rows: string[][] = [];
    for (const sourceRow of parsed.worksheet?.sheetData?.row ?? []) {
      const cells: string[] = [];
      for (const cell of sourceRow.c ?? []) {
        const reference = cell["@_r"]; if (!reference) return fail("INVALID_XLSX");
        const column = columnNumber(reference); if (column > 40) return fail("FILE_LIMIT");
        let value = "";
        if (!cell["@_t"] || cell["@_t"] === "n") value = spreadsheetNumber(cell.v ?? fail("EXACT_NUMBER_REQUIRED"));
        else if (cell["@_t"] === "str") value = cell.v ?? "";
        else if (cell["@_t"] === "inlineStr") value = cell.is?.t ?? "";
        else return fail("UNSUPPORTED_CELL");
        if (value.length > 160) return fail("CELL_LIMIT"); cells[column - 1] = value.trim();
      }
      for (let index = 0; index < cells.length; index++) cells[index] ??= "";
      if (cells.some(Boolean)) rows.push(cells);
    }
    if (rows.length > MAX_ROWS + 1) return fail("FILE_LIMIT");
    return rows;
  }
  const sheet = workbook.getWorksheet("Data"); if (!sheet || workbook.worksheets.some((s) => !["Data", "Instructions"].includes(s.name))) return fail("DATA_SHEET_REQUIRED");
  if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 40) return fail("FILE_LIMIT");
  const rows: string[][] = [];
  sheet.eachRow((row) => { const cells: string[] = []; for (let column = 1; column <= sheet.columnCount; column++) { const cell = row.getCell(column); const value = cell.value; let result = ""; if (value instanceof Date) result = value.toISOString().slice(0, 10); else if (typeof value === "number") result = spreadsheetNumber(numeric.get(cell.address) ?? fail("EXACT_NUMBER_REQUIRED")); else if (typeof value === "string") result = value; else if (value !== null && value !== undefined) return fail("UNSUPPORTED_CELL"); if (result.length > 160) return fail("CELL_LIMIT"); cells.push(result.trim()); } if (cells.some(Boolean)) rows.push(cells); });
  return rows;
}
