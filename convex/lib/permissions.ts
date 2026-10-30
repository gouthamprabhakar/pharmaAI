export const roles = ["owner", "administrator", "returns_operations", "finance", "inventory_control", "data_operations", "distributor", "viewer"] as const;
export type Role = (typeof roles)[number];
export type Capability = "read" | "configure" | "access" | "return_submit" | "return_review" | "receipt" | "credit" | "sales_submit" | "sales_review" | "manufacturer_import" | "reports" | "export" | "audit";

const grants: Record<Role, readonly Capability[]> = {
  owner: ["read", "configure", "access", "return_submit", "return_review", "receipt", "credit", "sales_submit", "sales_review", "manufacturer_import", "reports", "export", "audit"],
  administrator: ["read", "configure", "access", "return_submit", "return_review", "receipt", "credit", "sales_submit", "sales_review", "manufacturer_import", "reports", "audit"],
  returns_operations: ["read", "return_review", "receipt", "manufacturer_import", "reports"],
  finance: ["read", "credit", "manufacturer_import", "reports"],
  inventory_control: ["read", "sales_review", "manufacturer_import", "reports"],
  data_operations: ["read", "manufacturer_import"],
  distributor: ["read", "return_submit", "sales_submit"],
  viewer: ["read", "reports"],
};

export function can(role: Role, capability: Capability, exportGranted = false) {
  if (capability === "export" && role !== "owner") return role !== "viewer" && role !== "distributor" && exportGranted;
  return grants[role].includes(capability);
}

export function verificationAge(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((age) => Number.isFinite(age) && Number.isInteger(age) && age >= -1)) return null;
  return value as [number, number];
}

export function hasMfa(value: unknown) {
  const age = verificationAge(value);
  return age !== null && age[0] >= 0 && age[1] >= 0;
}

export function hasRecentMfa(value: unknown) {
  const age = verificationAge(value);
  return age !== null && age[0] >= 0 && age[0] < 10 && age[1] >= 0 && age[1] < 10;
}

// Clerk session v2 uses o.id; legacy/custom integrations may expose org_id.
// If signed claims disagree, deny rather than choosing a convenient tenant.
export function activeOrganization(claims: Record<string, unknown>): string | null {
  const compact = claims.o && typeof claims.o === "object" && !Array.isArray(claims.o) ? (claims.o as Record<string, unknown>).id : undefined;
  const values = [compact, claims.org_id, claims.organization_id].filter((value) => value !== undefined && value !== null);
  if (!values.length || values.some((value) => typeof value !== "string" || value.length === 0)) return null;
  const unique = new Set(values as string[]);
  return unique.size === 1 ? [...unique][0] : null;
}
