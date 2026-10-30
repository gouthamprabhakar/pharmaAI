import Decimal from "decimal.js";

// Isolated constructor: other packages cannot change financial precision/rounding.
const D = Decimal.clone({ precision: 80, toExpNeg: -80, toExpPos: 80 });
export type Rounding = "half_up" | "half_even" | "down";
const modes = { half_up: Decimal.ROUND_HALF_UP, half_even: Decimal.ROUND_HALF_EVEN, down: Decimal.ROUND_DOWN } as const;
const fail = (code: string): never => { throw new Error(code); };

export function decimal(value: string, signed = false) {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,6})?$/.test(value)) return fail("INVALID_DECIMAL");
  const n = new D(value);
  if (!signed && n.isNegative() && !n.isZero()) return fail("NEGATIVE_QUANTITY");
  return n;
}
export function quantity(value: string, signed = false) { return decimal(value, signed).toFixed(); }
export function rate(value: string) {
  const n = decimal(value);
  if (n.gt(100)) return fail("INVALID_PERCENT");
  return n;
}
export function paise(value: number) {
  if (!Number.isSafeInteger(value)) return fail("INVALID_PAISE");
  return value;
}
function integer(value: Decimal) {
  if (!value.isInteger()) return fail("MONEY_PRECISION");
  if (value.abs().gt(Number.MAX_SAFE_INTEGER)) return fail("MONEY_OVERFLOW");
  return value.toNumber(); // Exact conversion only after integer and safe-range checks.
}
export function rupeesToPaise(value: string) { return integer(decimal(value, true).times(100)); }
export function sumPaise(values: number[]) { return integer(values.reduce((sum, n) => sum.plus(paise(n)), new D(0))); }
export function roundPaise(value: Decimal, rounding: Rounding) {
  if (!(rounding in modes)) return fail("ROUNDING_REQUIRED");
  return integer(value.toDecimalPlaces(0, modes[rounding]));
}
// Explicit per-line component rounding: gross, deduction on gross, then tax on net.
// The configured policy must choose the rounding mode and applicable rates.
export function lineAmounts(qty: string, rupeesPerUnit: string, taxPercent: string, deductionPercent: string, rounding: Rounding) {
  const grossPaise = roundPaise(decimal(qty).times(decimal(rupeesPerUnit)).times(100), rounding);
  const deductionPaise = roundPaise(new D(grossPaise).times(rate(deductionPercent)).div(100), rounding);
  const net = new D(grossPaise).minus(deductionPaise);
  const taxPaise = roundPaise(net.times(rate(taxPercent)).div(100), rounding);
  return { grossPaise, deductionPaise, taxPaise, totalPaise: integer(net.plus(taxPaise)) };
}
export type StockInputs = { opening: string; receipts: string; customerReturns: string; transfersIn: string; onwardSales: string; manufacturerReturns: string; damage: string; transfersOut: string; approvedAdjustments: string };
export function expectedStock(input: StockInputs) {
  const additions = [input.opening, input.receipts, input.customerReturns, input.transfersIn];
  const removals = [input.onwardSales, input.manufacturerReturns, input.damage, input.transfersOut];
  const result = additions.reduce((n, v) => n.plus(decimal(v)), new D(0)).minus(removals.reduce((n, v) => n.plus(decimal(v)), new D(0))).plus(decimal(input.approvedAdjustments, true));
  return quantity(result.toFixed(), true);
}
export function quantityVariance(expected: string, reported: string) { return quantity(decimal(reported).minus(decimal(expected, true)).toFixed(), true); }
export function withinQuantityTolerance(variance: string, absoluteTolerance: string) { return decimal(variance, true).abs().lte(decimal(absoluteTolerance)); }
export function withinMoneyTolerance(variancePaise: number, tolerancePaise: number) {
  if (paise(tolerancePaise) < 0) return fail("INVALID_TOLERANCE");
  return new D(paise(variancePaise)).abs().lte(tolerancePaise);
}
