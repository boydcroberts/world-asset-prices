import { buildAssetDetailPayload } from "../server/asset-detail.js";
import { isHistoricalRange } from "../server/asset-registry.js";
import { createRequestId, logError, logEvent } from "../server/log.js";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const requestId = createRequestId();

  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(405).json({ error: "Method Not Allowed", requestId });
    return;
  }

  const id = firstQueryValue(request.query?.id)?.trim();
  const range = firstQueryValue(request.query?.range)?.trim().toUpperCase() ?? "30D";

  if (!id) {
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(400).json({ error: "Missing asset id", requestId });
    return;
  }

  if (!isHistoricalRange(range)) {
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(400).json({ error: "Invalid range", requestId });
    return;
  }

  logEvent("info", "api.asset-detail.request", { requestId, id, range });

  try {
    const payload = await buildAssetDetailPayload({ id, range });
    response.setHeader("X-Wap-Request-Id", requestId);
    // Asset detail is dominated by stable historical series; let the CDN/browser
    // cache it briefly so re-opening an asset or switching ranges doesn't refetch.
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=120, stale-while-revalidate=300");
    response.status(200).json({ ...payload, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "unknown_asset" || message === "asset_not_available"
        ? 404
        : message === "invalid_range"
          ? 400
          : 502;
    if (status >= 500) logError("api.asset-detail.failed", error, { requestId });
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(status).json({
      error: status === 404 ? "Asset not found" : status === 400 ? "Invalid range" : "Failed to build asset detail",
      requestId,
    });
  }
}
