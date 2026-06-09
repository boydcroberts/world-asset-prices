import { expect, test } from "@playwright/test";

test("dashboard smoke renders cards, symbols, logos, and status", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Global Assets Dashboard/i })).toBeVisible();
  await expect(page.getByLabel("Search markets")).toBeVisible();
  await expect(page.getByLabel("Sort markets")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 15 Global Assets" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 15 Cryptocurrencies" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 15 Public Companies" })).toBeVisible();

  const cards = page.locator(".coin-card");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  expect(await cards.count()).toBeGreaterThan(0);

  const pills = page.locator(".symbol-pill");
  await expect(pills.first()).toBeVisible({ timeout: 15_000 });
  expect(await pills.count()).toBeGreaterThan(0);

  const logos = page.locator(".asset-logo, .logo-fallback");
  expect(await logos.count()).toBeGreaterThan(0);

  const freshness = page.locator(".freshness-badge");
  await expect(freshness.first()).toBeVisible();
  expect(await freshness.count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Pin .* to watchlist/ }).first().click();
  await expect(page.getByRole("heading", { level: 2, name: "Pinned Watchlist" })).toBeVisible();

  await cards.first().hover();
});

test("shows stale/degraded status when providers are unavailable", async ({ page }) => {
  await page.goto("/");

  const degraded = page.locator(".freshness-badge--degraded");
  await expect(degraded.first()).toBeVisible({ timeout: 15_000 });
  await expect(degraded.first()).toContainText("Fallback");
});

test("renders logo fallback marks when logo network requests fail", async ({ page }) => {
  await page.route(/\.(png|jpg|jpeg|webp|avif|svg)(\?.*)?$/i, async (route) => {
    await route.abort();
  });

  await page.goto("/");

  const fallbackMarks = page.locator(".logo-fallback");
  await expect(fallbackMarks.first()).toBeVisible({ timeout: 15_000 });
  expect(await fallbackMarks.count()).toBeGreaterThan(0);
});

test("opens asset detail drawer with provenance and unsupported history states", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Show NVIDIA details/i }).first().click();
  const nvidiaDialog = page.getByRole("dialog", { name: /NVIDIA/i });
  await expect(nvidiaDialog).toBeVisible({ timeout: 15_000 });
  await expect(nvidiaDialog.getByText("Provider", { exact: true })).toBeVisible();
  await expect(nvidiaDialog.getByText("derived-market-cap")).toBeVisible();
  await expect(nvidiaDialog.getByText(/Verified as of/i)).toBeVisible();
  await page.getByRole("button", { name: /Close asset detail/i }).click();

  await page.getByRole("button", { name: /Show SpaceX details/i }).first().click();
  const spacexDialog = page.getByRole("dialog", { name: /SpaceX/i });
  await expect(spacexDialog).toBeVisible({ timeout: 15_000 });
  await expect(spacexDialog.getByText("curated-valuation")).toBeVisible();
  await expect(spacexDialog.getByText(/verified curated primary/i).first()).toBeVisible();
  await page.getByRole("button", { name: /Close asset detail/i }).click();

  // Databricks carries the alternate-valuation context (reported raise target)
  // since SpaceX's IPO pricing became its primary mark (2026-06-09).
  await page.getByRole("button", { name: /Show Databricks details/i }).first().click();
  const databricksDialog = page.getByRole("dialog", { name: /Databricks/i });
  await expect(databricksDialog).toBeVisible({ timeout: 15_000 });
  await expect(databricksDialog.getByText("Alternate context", { exact: true })).toBeVisible();
});

test("saves a local portfolio holding across reloads", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 2, name: "Portfolio Lab" })).toBeVisible();
  await expect(page.getByLabel("Portfolio asset")).toContainText("NVIDIA");
  await page.getByLabel("Portfolio asset").selectOption("stock-nvda");
  await page.getByLabel("Holding quantity").fill("2");
  await page.getByLabel("Holding cost basis").fill("300");
  await page.getByRole("button", { name: "Save holding" }).click();
  await expect(page.locator("#section-portfolio")).toContainText("NVIDIA");

  await page.reload();
  await expect(page.locator("#section-portfolio")).toContainText("NVIDIA");
  await expect(page.evaluate(() => localStorage.getItem("wap.portfolio.v1"))).resolves.toContain("stock-nvda");
});
