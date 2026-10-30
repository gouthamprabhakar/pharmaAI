import { ConvexError } from "convex/values";

export const invalid = (code = "INVALID_CONFIGURATION"): never => { throw new ConvexError({ code }); };
export function text(value: string, max = 160) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\x00-\x1f]/.test(normalized)) return invalid();
  return normalized;
}
export function code(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_.-]{0,63}$/.test(normalized)) return invalid("INVALID_CODE");
  return normalized;
}
export function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "2199-12-31") return invalid("INVALID_DATE");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalid("INVALID_DATE");
  return value;
}
export function integer(value: number, min: number, max: number) { if (!Number.isSafeInteger(value) || value < min || value > max) return invalid(); return value; }
export function timezone(value: string) { try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); } catch { return invalid("INVALID_TIMEZONE"); } return value; }
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value) return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return invalid("INVALID_FINGERPRINT");
}
// Collision-free versioned key; never hash/truncate identifiers or include mutable result/status.
export function fingerprint(kind: string, source: Record<string, string>) { return `v1:${code(kind)}:${canonicalJson(source)}`; }
export function selectEffective<T extends { effectiveFrom: string; version: number }>(versions: T[], businessDate: string): T | null {
  date(businessDate);
  return versions.filter((v) => v.effectiveFrom <= businessDate).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version)[0] ?? null;
}
