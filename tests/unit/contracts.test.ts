import { expect, test } from "vitest";
import { canonicalJson, date, fingerprint, selectEffective, timezone } from "../../convex/lib/contracts";

test("fingerprints are stable across property order and cannot merge different sources", () => {
  expect(fingerprint("stock", { invoice: "A", product: "B" })).toBe(fingerprint("stock", { product: "B", invoice: "A" }));
  expect(fingerprint("stock", { invoice: "A|B", product: "C" })).not.toBe(fingerprint("stock", { invoice: "A", product: "B|C" }));
  expect(fingerprint("stock", { invoice: "A" })).not.toBe(fingerprint("return", { invoice: "A" }));
  expect(canonicalJson({ x: [1, { b: true, a: null }], ignore: undefined })).toBe('{"x":[1,{"a":null,"b":true}]}');
  expect(() => canonicalJson(Number.NaN)).toThrow("INVALID_FINGERPRINT");
});
test.each(["2026-02-29", "2026-04-31", "2026-1-01", "2026-01-01T00:00Z", "2200-01-01"])("rejects invalid business date %s", (value) => expect(() => date(value)).toThrow("INVALID_DATE"));
test("business date selects the applicable immutable version, including boundaries and missing policy", () => {
  const versions = [{ version: 2, effectiveFrom: "2026-07-01", deduction: "10" }, { version: 1, effectiveFrom: "2026-01-01", deduction: "0" }];
  expect(selectEffective(versions, "2026-06-30")?.deduction).toBe("0");
  expect(selectEffective(versions, "2026-07-01")?.version).toBe(2);
  expect(selectEffective(versions, "2025-12-31")).toBeNull();
  expect(versions[0].version).toBe(2);
  expect(date("2024-02-29")).toBe("2024-02-29");
  expect(timezone("Asia/Kolkata")).toBe("Asia/Kolkata");
  expect(() => timezone("Not/AZone")).toThrow("INVALID_TIMEZONE");
});
