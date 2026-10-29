import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/", "/sign-in", "/workspace-invitation", "/setup", "/overview",
  "/data", "/returns", "/returns/PAI-RET-01048", "/sales",
  "/sales/SV-2026-0184", "/review-queue", "/reports", "/administration",
];

test("all approved MVP routes render at desktop without overflow", async ({ page }) => {
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
    "/workspace-invitation", "/setup", "/data", "/returns",
    "/sales/SV-2026-0184", "/administration",
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

test("workspace actions remain honest UI demos", async ({ page }) => {
  await page.goto("/workspace-invitation");
  await expect(page.getByText("Fictional demo")).toBeVisible();

  await page.goto("/returns");
  await page.getByPlaceholder("Search fictional records…").fill("Northstar");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "New return intake", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("simulated");
});

for (const route of [
  "/workspace-invitation", "/setup", "/data", "/returns",
  "/review-queue", "/administration",
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
