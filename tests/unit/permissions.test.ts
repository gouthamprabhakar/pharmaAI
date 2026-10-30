import { describe, expect, test } from "vitest";
import { activeOrganization, can, hasMfa, hasRecentMfa, roles } from "../../convex/lib/permissions";

describe("Phase 3 role capabilities", () => {
  test.each(roles)("%s can read permitted records", (role) => expect(can(role, "read")).toBe(true));
  test.each(roles.filter((role) => !["owner", "administrator"].includes(role)))("%s cannot manage access or configuration", (role) => {
    expect(can(role, "configure")).toBe(false);
    expect(can(role, "access")).toBe(false);
  });
  test("finance, return and stock actions are separated", () => {
    expect(can("finance", "credit")).toBe(true);
    expect(can("finance", "return_review")).toBe(false);
    expect(can("returns_operations", "return_review")).toBe(true);
    expect(can("returns_operations", "credit")).toBe(false);
    expect(can("inventory_control", "sales_review")).toBe(true);
    expect(can("inventory_control", "credit")).toBe(false);
  });
  test("distributors have only submission and own-record capabilities", () => {
    expect(can("distributor", "return_submit")).toBe(true);
    expect(can("distributor", "sales_submit")).toBe(true);
    for (const capability of ["reports", "audit", "configure", "return_review", "sales_review", "credit", "manufacturer_import", "export"] as const) expect(can("distributor", capability, true)).toBe(false);
  });
  test("export requires explicit grant, except owner; viewer can never export", () => {
    expect(can("owner", "export")).toBe(true);
    expect(can("administrator", "export")).toBe(false);
    expect(can("finance", "export", true)).toBe(true);
    expect(can("viewer", "export", true)).toBe(false);
  });
});

test("current and legacy signed organization claims agree; malformed or conflicting tenants fail closed", () => {
  expect(activeOrganization({ o: { id: "org_one" } })).toBe("org_one");
  expect(activeOrganization({ org_id: "org_one" })).toBe("org_one");
  expect(activeOrganization({ o: { id: "org_one" }, org_id: "org_one" })).toBe("org_one");
  expect(activeOrganization({ o: { id: "org_other" }, org_id: "org_one" })).toBeNull();
  expect(activeOrganization({ org_id: 1 })).toBeNull();
  expect(activeOrganization({ o: {} })).toBeNull();
  expect(activeOrganization({})).toBeNull();
});

describe("signed verification age validation", () => {
  test.each([undefined, null, [], [0], [0, -1], [-1, 0], [0, Infinity], [0, "0"], [0, 0, 0], [0, 0.5], [0, -2]])("rejects absent, malformed or single-factor MFA: %j", (value) => {
    expect(hasMfa(value)).toBe(false);
    expect(hasRecentMfa(value)).toBe(false);
  });
  test("regular MFA and step-up have distinct freshness requirements", () => {
    expect(hasMfa([50, 50])).toBe(true);
    expect(hasRecentMfa([50, 50])).toBe(false);
    expect(hasRecentMfa([0, 9])).toBe(true);
    expect(hasRecentMfa([0, 10])).toBe(false);
  });
});
