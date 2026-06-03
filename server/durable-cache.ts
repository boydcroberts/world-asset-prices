import { logError } from "./log.js";
import { isDashboardPayload } from "./dashboard-schema.js";
import type { DashboardPayload } from "./types.js";

type DurableRecord = {
  updatedAt: string;
  payload: DashboardPayload;
};

const DEFAULT_DASHBOARD_CACHE_KEY = "wap:dashboard:payload";

// Bound every durable-cache round-trip. Without this, an unresponsive Upstash
// REST endpoint would hang the bare fetch to the OS socket timeout (tens of
// seconds), burning the serverless function budget and risking a 504 instead of
// failing fast to the next fallback tier.
const DURABLE_CACHE_TIMEOUT_MS = 2_500;

function getEnvValue(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getDurableConfig() {
  const url = getEnvValue("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
  const token = getEnvValue("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
  const key = getEnvValue("DURABLE_CACHE_KEY") ?? DEFAULT_DASHBOARD_CACHE_KEY;

  return {
    url,
    token,
    key,
    configured: Boolean(url && token),
  };
}

export function isDurableCacheConfigured(): boolean {
  return getDurableConfig().configured;
}

async function callRedisCommand<T>(args: (string | number)[]): Promise<T | null> {
  const config = getDurableConfig();
  if (!config.configured || !config.url || !config.token) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DURABLE_CACHE_TIMEOUT_MS);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Durable cache request failed (${response.status})`);
    }

    const data = (await response.json()) as { result?: T };
    return data.result ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readDurableDashboard(maxAgeSec: number): Promise<DashboardPayload | null> {
  const config = getDurableConfig();
  if (!config.configured) {
    return null;
  }

  try {
    const result = await callRedisCommand<string>(["GET", config.key]);
    if (!result) {
      return null;
    }

    const parsed = JSON.parse(result) as DurableRecord;
    if (!parsed?.updatedAt || !parsed?.payload) {
      return null;
    }

    const ageMs = Date.now() - Date.parse(parsed.updatedAt);
    if (!Number.isFinite(ageMs) || ageMs > maxAgeSec * 1_000) {
      return null;
    }

    return isDashboardPayload(parsed.payload) ? parsed.payload : null;
  } catch (error) {
    logError("durable-cache.read.failed", error);
    return null;
  }
}

export async function writeDurableDashboard(payload: DashboardPayload, ttlSec: number): Promise<boolean> {
  const config = getDurableConfig();
  if (!config.configured) {
    return false;
  }

  const safeTtlSec = Math.max(60, Math.min(86_400, ttlSec));

  const record: DurableRecord = {
    updatedAt: new Date().toISOString(),
    payload,
  };

  try {
    await callRedisCommand(["SET", config.key, JSON.stringify(record), "EX", safeTtlSec]);
    return true;
  } catch (error) {
    logError("durable-cache.write.failed", error);
    return false;
  }
}
