import { expect, test } from "@playwright/test";

test("GitHub Pages static build serves dashboard and detail drawers without APIs", async ({ page }) => {
  const apiRequests: string[] = [];
  const staticDetailRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__local_api/")) {
      apiRequests.push(url.pathname);
    }
    if (url.pathname.includes("/data/asset-detail/")) {
      staticDetailRequests.push(url.pathname);
    }
  });

  await page.route("**/{api,__local_api}/**", async (route) => {
    const url = new URL(route.request().url());
    apiRequests.push(url.pathname);
    await route.abort("failed");
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /MERIDIAN live US market/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Largest Companies/i })).toBeVisible();
  await page.getByText("Watchlist, portfolio & full search").click();
  await expect(page.getByRole("heading", { level: 2, name: "Top 15 Public Companies" })).toBeVisible();
  await expect(page.locator(".coin-card").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /Show NVIDIA details/i }).first().click();
  const nvidiaDialog = page.getByRole("dialog", { name: /NVIDIA/i });
  await expect(nvidiaDialog).toBeVisible({ timeout: 15_000 });
  await expect(nvidiaDialog.getByText("derived-market-cap")).toBeVisible();
  await expect(nvidiaDialog.getByText(/static GitHub Pages build/i)).toBeVisible();
  await page.getByRole("button", { name: /Close asset detail/i }).click();

  await page.getByRole("button", { name: /Show SpaceX details/i }).first().click();
  const spacexDialog = page.getByRole("dialog", { name: /SpaceX/i });
  await expect(spacexDialog).toBeVisible({ timeout: 15_000 });
  await expect(spacexDialog.getByText("SPCX · Stock")).toBeVisible();
  await expect(spacexDialog.getByText("derived-market-cap")).toBeVisible();
  await expect(spacexDialog.getByText(/static GitHub Pages build/i)).toBeVisible();

  expect(apiRequests).toEqual([]);
  expect(staticDetailRequests.some((path) => path.endsWith("/stock-nvda-30D.json"))).toBe(true);
  expect(staticDetailRequests.some((path) => path.endsWith("/stock-spcx-30D.json"))).toBe(true);
});
