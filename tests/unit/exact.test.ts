import { expect, test } from "vitest";
import { expectedStock, lineAmounts, paise, quantity, quantityVariance, rate, rupeesToPaise, sumPaise, withinMoneyTolerance, withinQuantityTolerance } from "../../convex/lib/exact";

test("fractional rates and quantities have exact base-10 results", () => {
  expect(lineAmounts("0.1", "0.2", "0", "0", "half_up").totalPaise).toBe(2);
  expect(rupeesToPaise("0.29")).toBe(29);
  expect(sumPaise([29, 71, -1])).toBe(99);
  expect(quantity("10.100000")).toBe("10.1");
});
test.each(["NaN", "Infinity", "1e3", "0x10", "01", "1,000", " 1", "1.", "0.0000001", "1000000000000000000"])("rejects ambiguous or unsupported decimal %s", (value) => { expect(() => quantity(value)).toThrow(); });
test("negative quantities require explicit adjustment intent", () => { expect(() => quantity("-1")).toThrow("NEGATIVE_QUANTITY"); expect(quantity("-0.5", true)).toBe("-0.5"); expect(quantity("-0")).toBe("0"); });
test("money cannot silently round, overflow or accept fractions of a paise", () => {
  expect(() => rupeesToPaise("0.001")).toThrow("MONEY_PRECISION");
  expect(() => paise(1.1)).toThrow("INVALID_PAISE");
  expect(() => sumPaise([Number.MAX_SAFE_INTEGER, 1])).toThrow("MONEY_OVERFLOW");
  expect(rupeesToPaise("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
});
test("per-line gross, deduction and tax use explicit configured rounding", () => {
  expect(lineAmounts("2.5", "19.99", "18", "10", "half_up")).toEqual({ grossPaise: 4998, deductionPaise: 500, taxPaise: 810, totalPaise: 5308 });
  expect(lineAmounts("1", "0.005", "0", "0", "half_up").totalPaise).toBe(1);
  expect(lineAmounts("1", "0.005", "0", "0", "half_even").totalPaise).toBe(0);
  expect(lineAmounts("1", "0.009", "0", "0", "down").totalPaise).toBe(0);
  expect(() => rate("100.000001")).toThrow("INVALID_PERCENT");
  expect(() => rate("-1")).toThrow();
});
test("stock equation accounts for all independently named movements", () => {
  expect(expectedStock({ opening: "1000", receipts: "500", customerReturns: "10", transfersIn: "20", onwardSales: "800", manufacturerReturns: "30", damage: "5", transfersOut: "15", approvedAdjustments: "2.5" })).toBe("682.5");
  expect(expectedStock({ opening: "0.1", receipts: "0.2", customerReturns: "0", transfersIn: "0", onwardSales: "0.3", manufacturerReturns: "0", damage: "0", transfersOut: "0", approvedAdjustments: "-0.1" })).toBe("-0.1");
});
test("reported minus expected is signed and absolute tolerance includes the exact boundary", () => {
  expect(quantityVariance("700", "650")).toBe("-50");
  expect(withinQuantityTolerance("-50", "50")).toBe(true);
  expect(withinQuantityTolerance("50.000001", "50")).toBe(false);
  expect(withinMoneyTolerance(-100, 100)).toBe(true);
  expect(withinMoneyTolerance(101, 100)).toBe(false);
  expect(() => withinMoneyTolerance(0, -1)).toThrow("INVALID_TOLERANCE");
});
