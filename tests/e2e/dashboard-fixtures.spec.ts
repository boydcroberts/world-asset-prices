import { expect, test } from "@playwright/test";

import { visualAssetDetailFixture, visualDashboardFixture } from "./fixtures/dashboard-fixtures";

test("deterministic fixture renders detail drawer, portfolio, and responsive controls", async ({ page }) => {
  await page.route("**/__local_api/dashboard", async (route) => {
    await route.fulfill({ json: visualDashboardFixture });
  });
  await page.route("**/__local_api/asset-detail**", async (route) => {
    await route.fulfill({ json: visualAssetDetailFixture });
  });
  await page.addInitScript(() => localStorage.setItem("wap.theme.v1", "dark"));

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /MERIDIAN live US market/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Largest Companies/i })).toBeVisible();
  await page.getByRole("button", { name: /Show NVIDIA details/i }).first().click();
  await expect(page.getByRole("dialog", { name: "NVIDIA" })).toBeVisible();
  await expect(page.locator(".detail-chart")).toBeVisible();

  await page.getByRole("button", { name: /Close asset detail/i }).click();
  await page.getByText("Watchlist, portfolio & full search").click();
  await page.getByLabel("Holding quantity").fill("3");
  await page.getByRole("button", { name: "Save holding" }).click();
  await expect(page.locator("#section-portfolio")).toContainText("NVIDIA");

  const audit = await page.evaluate(() => ({
    overflowX: Math.max(0, document.body.scrollWidth - document.documentElement.clientWidth),
    smallControls: [...document.querySelectorAll("button, a, input, select")].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width < 32 || rect.height < 32;
    }).length,
  }));

  expect(audit.overflowX).toBe(0);
  expect(audit.smallControls).toBe(0);
});
