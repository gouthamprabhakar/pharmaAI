import type { Role } from "./permissions";
export type IntakeType = "manufacturer_sales_shipments" | "distributor_return_claim" | "distributor_sales_stock" | "issued_credit_notes";
export function allowedIntakeTypes(role: Role): IntakeType[] {
  if (role === "owner" || role === "administrator") return ["manufacturer_sales_shipments", "distributor_return_claim", "distributor_sales_stock", "issued_credit_notes"];
  if (role === "distributor") return ["distributor_return_claim", "distributor_sales_stock"];
  if (role === "finance") return ["issued_credit_notes"];
  if (role === "data_operations" || role === "inventory_control") return ["manufacturer_sales_shipments"];
  return [];
}
