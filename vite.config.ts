import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { buildDashboardPayload } from "./server/dashboard";
import { buildAssetDetailPayload } from "./server/asset-detail";
import { dashboardEntries, isHistoricalRange } from "./server/asset-registry";
import { isDashboardPayload } from "./server/dashboard-schema";
import { buildHealthPayload } from "./server/health";
import { createRequestId } from "./server/log";
import fallbackPayloadJson from "./server/fallback/dashboard-fallback.json" with { type: "json" };
import type { DashboardPayload, HistoricalRange } from "./server/types";

function localApiPlugin(): Plugin {
  return {
    name: "local-api-plugin",
    configureServer(server) {
      const localApiHandler = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
        const parsedUrl = new URL(request.url ?? "/", "http://localhost");
        const url = parsedUrl.pathname;
        if (!url) {
          next();
          return;
        }

        if (url === "/__local_api/health" && request.method === "GET") {
          const requestId = createRequestId();
          response.setHeader("Content-Type", "application/json");
          response.statusCode = 200;
          response.end(JSON.stringify(buildHealthPayload(requestId)));
          return;
        }

        if (url === "/__local_api/dashboard" && request.method === "GET") {
          const requestId = createRequestId();
          try {
            const payload = await buildDashboardPayload();
            response.setHeader("Content-Type", "application/json");
            response.statusCode = 200;
            response.end(JSON.stringify({ ...payload, requestId }));
          } catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            response.setHeader("Content-Type", "application/json");
            response.statusCode = 502;
            response.end(JSON.stringify({ error: "Failed to build dashboard payload", reason: message, requestId }));
          }
          return;
        }

        if (url === "/__local_api/asset-detail" && request.method === "GET") {
          const requestId = createRequestId();
          const id = parsedUrl.searchParams.get("id")?.trim();
          const range = (parsedUrl.searchParams.get("range")?.trim().toUpperCase() || "30D");

          response.setHeader("Content-Type", "application/json");
          if (!id) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: "Missing asset id", requestId }));
            return;
          }
          if (!isHistoricalRange(range)) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: "Invalid range", requestId }));
            return;
          }

          try {
            const payload = await buildAssetDetailPayload({ id, range });
            response.statusCode = 200;
            response.end(JSON.stringify({ ...payload, requestId }));
          } catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            response.statusCode = message === "unknown_asset" || message === "asset_not_available" ? 404 : 502;
            response.end(JSON.stringify({ error: response.statusCode === 404 ? "Asset not found" : "Failed to build asset detail", requestId }));
          }
          return;
        }

        if (url === "/__local_api/client-error" && request.method === "POST") {
          response.setHeader("Content-Type", "application/json");
          response.statusCode = 202;
          response.end(JSON.stringify({ ok: true }));
          return;
        }

        next();
      };

      server.middlewares.use(localApiHandler);
    },
  };
}

const isGitHubPages = Boolean(process.env.GITHUB_PAGES);
const STATIC_DETAIL_RANGES: HistoricalRange[] = ["7D", "30D", "1Y"];

function fallbackDashboardPayload(): DashboardPayload {
  const payload = fallbackPayloadJson as unknown;
  if (!isDashboardPayload(payload)) {
    throw new Error("Invalid bundled fallback dashboard payload");
  }

  return payload;
}

/**
 * Copies fallback dashboard/detail JSON into the build output so GitHub Pages
 * (a static host with no serverless backend) can serve the core experience.
 */
function githubPagesFallbackPlugin(): Plugin {
  return {
    name: "github-pages-fallback",
    apply: "build",
    async closeBundle() {
      if (!isGitHubPages) return;
      const payload = fallbackDashboardPayload();
      const src = resolve(__dirname, "server/fallback/dashboard-fallback.json");
      const destDir = resolve(__dirname, "dist/data");
      const detailDir = resolve(destDir, "asset-detail");
      mkdirSync(destDir, { recursive: true });
      mkdirSync(detailDir, { recursive: true });
      copyFileSync(src, resolve(destDir, "dashboard.json"));

      for (const entry of dashboardEntries(payload)) {
        for (const range of STATIC_DETAIL_RANGES) {
          const detail = await buildAssetDetailPayload({
            id: entry.id,
            range,
            dashboard: payload,
            historyMode: "static-disabled",
            now: () => Date.parse(payload.generatedAt),
          });
          writeFileSync(resolve(detailDir, `${entry.id}-${range}.json`), JSON.stringify(detail));
        }
      }
    },
  };
}

export default defineConfig({
  base: isGitHubPages ? "/world-asset-prices/" : "/",
  define: {
    __GITHUB_PAGES__: JSON.stringify(isGitHubPages),
  },
  plugins: [tailwindcss(), react(), localApiPlugin(), githubPagesFallbackPlugin()],
  server: {
    host: "localhost",
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: 5189,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // react-dom/client must be listed explicitly or Rollup resolves
          // react-dom through @tanstack/react-query first and bundles it into
          // query-vendor, coupling the react cache fingerprint to query upgrades.
          "react-vendor": ["react", "react-dom", "react-dom/client"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
});
