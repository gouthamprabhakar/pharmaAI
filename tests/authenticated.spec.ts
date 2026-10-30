import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import AxeBuilder from "@axe-core/playwright";

type Fixture = { runId: string; clerkOrganizationId: string; organizationId: Id<"organizations">; otherOrganizationId: Id<"organizations">; unitId: Id<"operationalUnits">; deniedUnitId: Id<"operationalUnits">; distributorId: Id<"distributors">; otherDistributorId: Id<"distributors">; ownerEmail: string; distributorEmail: string; outsiderEmail: string; inviteeEmail: string };
const fixture = () => JSON.parse(readFileSync(".test-state/fixture.json", "utf8")) as Fixture;
// Do not retain session tokens in browser network traces or auth-state files.
test.use({ trace: "off" });

test.describe("real development sessions and scoped workspace access", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  async function signIn(page: Page, emailAddress: string) {
    await page.goto("/");
    await clerk.signIn({ page, emailAddress });
    await page.goto("/overview");
  }
  async function openWorkspace(page: Page) {
    const open = page.getByRole("button", { name: "Open Fictional Browser Test Manufacturer", exact: true });
    const overview = page.getByRole("heading", { name: "Overview", exact: true });
    await clerk.loaded({ page });
    await expect.poll(async () => await open.isVisible() || await overview.isVisible(), { timeout: 30_000 }).toBe(true);
    if (await open.isVisible()) await open.click();
    await expect(overview).toBeVisible({ timeout: 30_000 });
  }
  async function backend(page: Page) {
    const token = await page.evaluate(async () => window.Clerk.session?.getToken({ skipCache: true }));
    if (!token) throw new Error("No authenticated Convex token");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    client.setAuth(token);
    return client;
  }

  test("owner selects a real membership, gets server-authorized context and cannot read another tenant", async ({ page }) => {
    const f = fixture();
    await signIn(page, f.ownerEmail);
    await openWorkspace(page);
    await expect(page.getByText("Fictional Browser Test Manufacturer", { exact: true })).toBeVisible();
    const client = await backend(page);
    const context = await client.query(api.access.context, { organizationId: f.organizationId });
    expect(context.role).toBe("owner");
    expect(context.units).toHaveLength(2);
    expect(await client.query(api.access.pendingInvitations, {})).toEqual([]);
    await expect(client.query(api.access.context, { organizationId: f.otherOrganizationId })).rejects.toThrow("ORGANIZATION_REQUIRED");
  });

  test("distributor sees only its assigned unit/distributor and cannot perform finance work", async ({ page }) => {
    const f = fixture();
    await signIn(page, f.distributorEmail);
    await openWorkspace(page);
    const client = await backend(page);
    const context = await client.query(api.access.context, { organizationId: f.organizationId });
    expect(context.units.map((u) => u.id)).toEqual([f.unitId]);
    expect(context.distributors.map((d) => d.id)).toEqual([f.distributorId]);
    const args = { organizationId: f.organizationId, operationalUnitId: f.unitId, distributorId: f.distributorId, capability: "sales_submit" as const };
    expect(await client.query(api.access.scopedProbe, args)).toEqual({ permitted: true });
    await expect(client.query(api.access.scopedProbe, { ...args, distributorId: f.otherDistributorId })).rejects.toThrow("ACCESS_DENIED");
    await expect(client.query(api.access.scopedProbe, { ...args, operationalUnitId: f.deniedUnitId })).rejects.toThrow("ACCESS_DENIED");
    await expect(client.query(api.access.scopedProbe, { ...args, capability: "credit" })).rejects.toThrow("ACCESS_DENIED");
  });

  test("an authenticated but uninvited user sees no manufacturer records", async ({ page }) => {
    await signIn(page, fixture().outsiderEmail);
    await expect(page.getByRole("heading", { name: "Workspace access required" })).toBeVisible();
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
    await expect(page.locator("tbody")).toHaveCount(0);
  });

  test("the actual Sign out button clears access and returns to the landing page", async ({ page }) => {
    await signIn(page, fixture().ownerEmail);
    await openWorkspace(page);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("/", { timeout: 30_000 });
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
  });

  test("Team & access opens the real scoped member list and preserves keyboard focus on close", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await signIn(page, fixture().ownerEmail);
    await openWorkspace(page);
    await page.getByRole("link", { name: "Administration", exact: true }).click();
    const manage = page.getByRole("button", { name: "Manage Team & access", exact: true });
    await manage.click();
    const dialog = page.getByRole("dialog", { name: "Team & access", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(fixture().distributorEmail, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Email address", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "artifacts/phase3-team-access-connected-1440.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(manage).toBeFocused();
  });

  test("an intended invitee accepts a stored scoped grant using real verified email claims", async ({ page }) => {
    const f = fixture();
    await signIn(page, f.ownerEmail);
    await openWorkspace(page);
    const owner = await backend(page);
    await owner.mutation(api.access.prepareInvitation, { organizationId: f.organizationId, email: f.inviteeEmail, role: "viewer", operationalUnitIds: [f.unitId], idempotencyKey: `${f.runId}-invitee` });
    // This tests application acceptance after Clerk organization membership;
    // no outbound invitation email or Google OAuth/MFA is claimed by this test.
    await clerk.signOut({ page });
    await signIn(page, f.inviteeEmail);
    await expect(page.getByRole("heading", { name: "Invitation to Fictional Browser Test Manufacturer" })).toBeVisible({ timeout: 30_000 });
    const choose = page.getByRole("button", { name: "Open Fictional Browser Test Manufacturer", exact: true });
    if (await choose.isVisible()) await choose.click();
    await page.getByRole("button", { name: "Accept workspace invitation", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible({ timeout: 30_000 });
    const context = await (await backend(page)).query(api.access.context, { organizationId: f.organizationId });
    expect(context.role).toBe("viewer");
    expect(context.units.map((u) => u.id)).toEqual([f.unitId]);
  });

  test("manufacturer setup persists master data, controlled rules and deadlines across reload", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1024 });
    const f = fixture(); await signIn(page, f.ownerEmail); await openWorkspace(page);
    await page.goto("/setup");
    const editor = page.locator(".configuration-editor");
    const save = async () => { await editor.getByLabel("Reason for change", { exact: true }).fill("Fictional pilot setup reviewed for browser test"); await editor.getByRole("button", { name: "Save configuration", exact: true }).click(); await expect(editor.getByRole("status")).toHaveText("Configuration saved. Its version and audit record were retained."); };
    await editor.getByLabel("Time zone", { exact: true }).fill("Asia/Kolkata"); await save();
    await page.getByRole("button", { name: "Continue setup", exact: true }).click();
    await editor.getByLabel("Unit name", { exact: true }).fill("Fictional Setup Depot"); await editor.getByLabel("Unit code", { exact: true }).fill("SETUP-DEPOT"); await editor.getByLabel("Unit type", { exact: true }).selectOption("depot"); await save();
    await page.getByRole("button", { name: "Continue setup", exact: true }).click();
    await editor.getByLabel("Distributor name", { exact: true }).fill("Fictional Setup Distributor"); await editor.getByLabel("Distributor code", { exact: true }).fill("SETUP-D01"); await editor.getByRole("checkbox", { name: "Fictional Setup Depot", exact: true }).check(); await save();
    await page.getByRole("button", { name: "Continue setup", exact: true }).click();
    await editor.getByLabel("Operational unit", { exact: true }).selectOption({ label: "Fictional Setup Depot" }); await editor.getByLabel("Effective from", { exact: true }).fill("2026-01-01"); await editor.getByLabel("Evidence type", { exact: true }).selectOption("distributor_sales_stock"); await save();
    const area = page.getByLabel("Configure templates and rules", { exact: true });
    await area.selectOption("products"); await editor.getByLabel("Product name", { exact: true }).fill("Fictional Setup Product"); await editor.getByLabel("Product code", { exact: true }).fill("SETUP-P01"); await editor.getByLabel("Quantity unit", { exact: true }).fill("packs"); await save();
    await area.selectOption("policies"); await editor.getByLabel("Operational unit", { exact: true }).selectOption({ label: "Fictional Setup Depot" }); await editor.getByLabel("Effective from", { exact: true }).fill("2026-01-01"); await editor.getByLabel("Policy code", { exact: true }).fill("RETURN-TEST"); await editor.getByLabel("Policy version date basis", { exact: true }).selectOption("return_date");
    for (const [label, value] of [["Allowed reasons, separated by commas", "EXPIRED"], ["Allowed days before expiry", "30"], ["Allowed days after expiry", "90"], ["Credit due within days of approval", "30"], ["Deduction percent", "0"], ["Tax percent", "0"]]) await editor.getByLabel(label, { exact: true }).fill(value);
    await editor.getByLabel("Line rounding", { exact: true }).selectOption("half_up"); await save();
    await area.selectOption("tolerances"); await editor.getByLabel("Operational unit", { exact: true }).selectOption({ label: "Fictional Setup Depot" }); await editor.getByLabel("Effective from", { exact: true }).fill("2026-01-01"); await editor.getByLabel("Absolute quantity tolerance", { exact: true }).fill("0"); await editor.getByLabel("Absolute value tolerance (INR)", { exact: true }).fill("0.01"); await save();
    await area.selectOption("deadlines"); await editor.getByLabel("Operational unit", { exact: true }).selectOption({ label: "Fictional Setup Depot" }); await editor.getByLabel("Effective from", { exact: true }).fill("2026-01-01"); await editor.getByLabel("Distributor", { exact: true }).selectOption({ label: "Fictional Setup Distributor" }); await editor.getByLabel("Monthly report template", { exact: true }).selectOption({ label: "Fictional Setup Depot · version 1 · 2026-01-01" }); await editor.getByLabel("Due day of following month (1–28)", { exact: true }).fill("7"); await save();
    await page.reload(); await expect(page.getByText("Guided setup · Step 4 of 4", { exact: true })).toBeVisible();
    const config = await (await backend(page)).query(api.configuration.read, { organizationId: f.organizationId });
    expect(config.organization.timezone).toBe("Asia/Kolkata"); expect(config.products.some((p) => p.code === "SETUP-P01")).toBe(true); expect(config.policies[0].rules.taxPercent).toBe("0"); expect(config.tolerances[0].valuePaise).toBe(1); expect(config.obligations[0].dueDayNextMonth).toBe(7);
    await page.goto("/administration"); await page.getByRole("button", { name: "Manage Templates & product codes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Templates & product codes", exact: true }); await expect(dialog.getByText("SETUP-P01 · Fictional Setup Product · packs · Active", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "artifacts/phase4-configuration-connected-1440.png" });
    await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  });

  test("restricted distributor cannot open manufacturer setup or retrieve policy configuration", async ({ page }) => {
    const f = fixture(); await signIn(page, f.distributorEmail); await openWorkspace(page);
    await expect((await backend(page)).query(api.configuration.read, { organizationId: f.organizationId })).rejects.toThrow("ACCESS_DENIED");
    await page.goto("/setup"); await expect(page.getByRole("heading", { name: "Setup access required" })).toBeVisible(); await expect(page.locator(".configuration-editor")).toHaveCount(0);
  });

  test("membership removal blocks the already-signed-in distributor on its next request", async ({ page }) => {
    const f = fixture();
    await signIn(page, f.distributorEmail);
    await openWorkspace(page);
    const client = await backend(page);
    execFileSync("npx", ["convex", "run", "testing:deactivate", JSON.stringify({ organizationId: f.organizationId, runId: f.runId, distributorOnly: true }), "--deployment", "dev"], { stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
    await expect(client.query(api.access.context, { organizationId: f.organizationId })).rejects.toThrow("ACCESS_DENIED");
    await expect(page.getByRole("heading", { name: "Workspace access required" })).toBeVisible({ timeout: 30_000 });
  });
});
