import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 390, 640, 768, 1024, 1100, 1180, 1280, 1440, 1920]) {
  test(`landing fits at ${width}px and keeps financial amounts on one line`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 1440 ? 1024 : 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Reconcile every",
    );
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      amounts: Array.from(document.querySelectorAll(".metric-amount")).map(
        (el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rect = el.getBoundingClientRect();
          return {
            lines: range.getClientRects().length,
            clipped: el.scrollWidth > el.clientWidth,
            right: rect.right,
          };
        },
      ),
    }));
    expect(layout.overflow).toBe(false);
    expect(layout.amounts).toHaveLength(3);
    for (const amount of layout.amounts) {
      expect(amount.lines).toBe(1);
      expect(amount.clipped).toBe(false);
      expect(amount.right).toBeLessThanOrEqual(width);
    }
    expect(errors).toEqual([]);
    if ([390, 768, 1024, 1280, 1440].includes(width)) {
      await page.screenshot({
        path: `artifacts/web/landing-${testInfo.project.name}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });
}

test("navigation, demo evidence, keyboard dismissal, and focus return work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/");
  await page.getByRole("link", { name: "Product", exact: true }).click();
  await expect(page).toHaveURL(/#product$/);
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  const trigger = page
    .getByRole("button", { name: "Start with sample data" })
    .first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("₹3,52,500.00");
  await expect(dialog).toContainText("synthetic demo data");
  await page.keyboard.press("Tab");
  // Native dialogs may move Tab focus to browser chrome (document.body),
  // but must never let it reach an interactive element behind the modal.
  expect(
    await page.evaluate(
      () =>
        document.activeElement === document.body ||
        !!document.activeElement?.closest("dialog"),
    ),
  ).toBe(true);
  expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page
    .getByRole("button", { name: "Open source: Original manufacturer invoice" })
    .click();
  await expect(dialog).toContainText("INV-2026-78142");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Security & privacy", exact: true })
    .click();
  await expect(dialog).toContainText("fictional sample data only");
  await page.keyboard.press("Escape");
});

test("Google-only sign-in supports recovery navigation and invitation-only feedback", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Sign in", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".auth-expired")).toContainText(
    "Invitation-only access",
  );
  await expect(page.getByRole("button", { name: /Continue with Google|Opening Google/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend code" })).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Contact your PharmaAI workspace administrator",
  );
  await page.getByRole("link", { name: "PharmaAI home" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Reconcile every",
  );
});

test("landing, dialog, and sign-in pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Start with sample data" })
    .first()
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.goto("/sign-in");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("landing content is server-rendered without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Reconcile every",
  );
  await expect(page.getByText("₹21,92,500.00", { exact: true })).toBeVisible();
  await context.close();
});
