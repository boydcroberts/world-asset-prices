import { expect, test, type Page } from "@playwright/test";

import {
  degradedDashboardFixture,
  visualAnthropicDetailFixture,
  visualAssetDetailFixture,
  visualDashboardFixture,
  visualSpacexDetailFixture,
} from "./fixtures/dashboard-fixtures";

async function mockDashboardApi(page: Page, dashboard = visualDashboardFixture) {
  await page.route("**/__local_api/dashboard", async (route) => {
    await route.fulfill({ json: dashboard });
  });
  await page.route("**/__local_api/asset-detail**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get("id");
    const detail = id === "stock-spcx"
      ? visualSpacexDetailFixture
      : id === "private-anthropic"
        ? visualAnthropicDetailFixture
        : visualAssetDetailFixture;
    await route.fulfill({ json: detail });
  });
  await page.addInitScript(() => localStorage.setItem("wap.theme.v1", "dark"));
}

async function openFullSearchSection(page: Page) {
  await page.getByText("Watchlist, portfolio & full search").click();
}

test("dashboard smoke renders cards, symbols, logos, and status", async ({ page }) => {
  await mockDashboardApi(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /MERIDIAN live US market/i })).toBeVisible();
  await expect(page.locator(".lh-eyebrow")).toContainText("S&P 500");
  await expect(page.getByRole("heading", { level: 2, name: /Largest Companies/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Gainers" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Decliners" })).toBeVisible();

  await openFullSearchSection(page);
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
  await mockDashboardApi(page, degradedDashboardFixture);
  await page.goto("/");
  await openFullSearchSection(page);

  const degraded = page.locator(".freshness-badge--degraded");
  await expect(degraded.first()).toBeVisible({ timeout: 15_000 });
  await expect(degraded.first()).toContainText("Fallback");
});

test("renders logo fallback marks when logo network requests fail", async ({ page }) => {
  await mockDashboardApi(page);
  await page.route(/\.(png|jpg|jpeg|webp|avif|svg)(\?.*)?$/i, async (route) => {
    await route.abort();
  });

  await page.goto("/");

  const fallbackMarks = page.locator(".logo-fallback");
  await expect(fallbackMarks.first()).toBeVisible({ timeout: 15_000 });
  expect(await fallbackMarks.count()).toBeGreaterThan(0);
});

test("opens asset detail drawer with provenance and unsupported history states", async ({ page }) => {
  await mockDashboardApi(page);
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
  await expect(spacexDialog.getByText("SPCX · Stock")).toBeVisible();
  await expect(spacexDialog.getByText("derived-market-cap")).toBeVisible();
  await page.getByRole("button", { name: /Close asset detail/i }).click();

  await openFullSearchSection(page);
  await page.getByRole("button", { name: /Show Anthropic details/i }).first().click();
  const anthropicDialog = page.getByRole("dialog", { name: /Anthropic/i });
  await expect(anthropicDialog).toBeVisible({ timeout: 15_000 });
  await expect(anthropicDialog.getByText("curated-valuation")).toBeVisible();
});

test("saves a local portfolio holding across reloads", async ({ page }) => {
  await mockDashboardApi(page);
  await page.goto("/");
  await openFullSearchSection(page);

  await expect(page.getByRole("heading", { level: 2, name: "Portfolio Lab" })).toBeVisible();
  await expect(page.getByLabel("Portfolio asset")).toContainText("NVIDIA");
  await page.getByLabel("Portfolio asset").selectOption("stock-nvda");
  await page.getByLabel("Holding quantity").fill("2");
  await page.getByLabel("Holding cost basis").fill("300");
  await page.getByRole("button", { name: "Save holding" }).click();
  await expect(page.locator("#section-portfolio")).toContainText("NVIDIA");

  await page.reload();
  await openFullSearchSection(page);
  await expect(page.locator("#section-portfolio")).toContainText("NVIDIA");
  await expect(page.evaluate(() => localStorage.getItem("wap.portfolio.v1"))).resolves.toContain("stock-nvda");
});
