import { date, integer, timezone } from "./contracts";
export function businessDate(timestamp: number, zone: string) {
  timezone(zone); const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(timestamp);
  const get = (part: string) => parts.find((p) => p.type === part)?.value;
  return date(`${get("year")}-${get("month")}-${get("day")}`);
}
export function addDays(value: string, days: number) { date(value); integer(days, 0, 3650); const result = new Date(`${value}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return date(result.toISOString().slice(0, 10)); }
export function daysBetween(from: string, to: string) { return (Date.parse(`${date(to)}T00:00:00Z`) - Date.parse(`${date(from)}T00:00:00Z`)) / 86400000; }
