import { expect, test } from "@playwright/test";

for (const route of ["/overview", "/data", "/returns", "/sales", "/review-queue", "/reports", "/administration", "/account/security"]) {
  test(`anonymous navigation to ${route} exposes no workspace data`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
    await expect(page.locator("tbody")).toHaveCount(0);
  });
}

test("Google-only sign-in explains invitation access and preserves recovery navigation", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Invitation-only access", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google|Opening Google/ })).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("workspace administrator");
  await page.getByRole("link", { name: "PharmaAI home" }).click();
  await expect(page).toHaveURL("/");
});

test("account verification remains reachable without exposing company records", async ({ page }) => {
  await page.goto("/verify");
  await expect(page.getByRole("heading", { name: "Complete account verification" })).toBeVisible();
  await expect(page.locator(".workspace-shell")).toHaveCount(0);
  await expect(page.locator("tbody")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Google sign-in" }).click();
  await expect(page).toHaveURL("/sign-in");
});
