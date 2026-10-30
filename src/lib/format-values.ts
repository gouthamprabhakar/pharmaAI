export const statusLabel = (value: string) => value.replaceAll("_", " ");
export function inr(paise: number | null | undefined) {
  if (paise === undefined || paise === null) return "—";
  if (!Number.isSafeInteger(paise)) return "Amount unavailable";
  const n = BigInt(paise); const absolute = n < 0n ? -n : n; const fraction = String(absolute % 100n).padStart(2, "0");
  return `${n < 0n ? "−" : ""}₹${(absolute / 100n).toLocaleString("en-IN")}${fraction === "00" ? "" : `.${fraction}`}`;
}
