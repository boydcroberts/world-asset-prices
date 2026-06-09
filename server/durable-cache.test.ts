import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardFallbackPayload } from "./dashboard";
import { readDurableDashboard, writeDurableDashboard } from "./durable-cache";

describe("readDurableDashboard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: "https://redis.example.test",
      KV_REST_API_TOKEN: "token",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("rejects durable cache records without a valid dashboard payload shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: JSON.stringify({
              updatedAt: new Date().toISOString(),
              payload: {
                generatedAt: new Date().toISOString(),
                topStocks: "not-an-array",
              },
            }),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(readDurableDashboard(600)).resolves.toBeNull();
  });

  it("rejects durable cache records with invalid entry fields inside arrays", async () => {
    const payload = structuredClone(dashboardFallbackPayload);
    payload.topStocks = [
      {
        ...payload.topStocks[0],
        id: 123 as unknown as string,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          result: JSON.stringify({
            updatedAt: new Date().toISOString(),
            payload,
          }),
        }),
      ),
    );

    await expect(readDurableDashboard(600)).resolves.toBeNull();
  });
});

describe("writeDurableDashboard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: "https://redis.example.test",
      KV_REST_API_TOKEN: "token",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns false without issuing a request when not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(writeDurableDashboard(structuredClone(dashboardFallbackPayload), 600)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues a SET ... EX command with the TTL clamped to [60, 86400]", async () => {
    const fetchMock = vi.fn(async () => Response.json({ result: "OK" }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = structuredClone(dashboardFallbackPayload);
    await expect(writeDurableDashboard(payload, 5)).resolves.toBe(true);
    await expect(writeDurableDashboard(payload, 999_999)).resolves.toBe(true);

    const commands = fetchMock.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
    expect(commands[0][0]).toBe("SET");
    expect(commands[0][1]).toBe("wap:dashboard:payload");
    expect(commands[0].slice(3)).toEqual(["EX", 60]);
    expect(commands[1].slice(3)).toEqual(["EX", 86_400]);

    const record = JSON.parse(commands[0][2]);
    expect(typeof record.updatedAt).toBe("string");
    expect(record.payload.topStocks.length).toBeGreaterThan(0);
  });

  it("returns false when the redis request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    await expect(writeDurableDashboard(structuredClone(dashboardFallbackPayload), 600)).resolves.toBe(false);
  });
});
