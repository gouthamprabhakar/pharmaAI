import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/", "/sign-in", "/workspace-invitation",
  "/onboarding/organization", "/onboarding/operational-unit",
  "/onboarding/channel-partner", "/onboarding/sample-data", "/overview",
  "/imports", "/imports/new", "/imports/processing",
  "/imports/column-mapping", "/imports/validation",
  "/documents/extraction-review", "/returns",
  "/returns/cases/DRT-2026-1048", "/returns/credit-notes",
  "/returns/runs", "/sales", "/sales/variance",
  "/sales/distributor-inventory", "/sales/inventory-adjustment",
  "/sales/runs", "/review-queue", "/review-queue/REV-2026-0241",
  "/reports", "/notifications", "/team", "/audit-history", "/settings",
  "/settings/operational-units", "/settings/distributors-stockists",
  "/settings/reconciliation-rules", "/settings/security", "/system-states",
];

test("all 35 design routes render at desktop without overflow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1024 });
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.ok(), route).toBe(true);
    await expect(page.locator("h1").first(), route).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
      route,
    ).toBe(0);
  }
});

test("major layout families remain usable at responsive widths", async ({ page }) => {
  test.setTimeout(90_000);
  const representativeRoutes = [
    "/workspace-invitation", "/onboarding/organization", "/imports",
    "/settings", "/system-states",
  ];
  for (const width of [1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1024 });
    for (const route of representativeRoutes) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(0);
    }
  }
});

test("invitation, onboarding, workspace, and state actions are honest UI demos", async ({ page }) => {
  await page.goto("/workspace-invitation");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByRole("status")).toContainText("No workspace access");

  await page.goto("/onboarding/organization");
  await page.getByRole("button", { name: "Continue", exact: false }).click();
  await expect(page.getByRole("status")).toContainText("No records were created");

  await page.goto("/imports");
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(page.getByRole("tab", { name: "Processing" })).toHaveAttribute(
    "aria-selected", "true",
  );
  await page.getByPlaceholder("Search fictional records...").fill("returns_oct");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "New import", exact: false }).click();
  await expect(page.getByRole("status")).toContainText("simulated");

  await page.goto("/system-states");
  await page.getByRole("button", { name: "Safe action" }).first().click();
  await expect(page.getByRole("status")).toContainText("recovery is simulated");
});

for (const route of [
  "/workspace-invitation", "/onboarding/organization", "/imports",
  "/settings", "/system-states",
]) {
  test(`${route} passes automated WCAG A/AA checks`, async ({ page }) => {
    await page.goto(route);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
