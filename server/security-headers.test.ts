import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  headers: Array<{ headers: Array<{ key: string; value: string }> }>;
};

function loadHeaderMap(): Map<string, string> {
  const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as VercelConfig;
  return new Map(config.headers[0]?.headers.map((header) => [header.key, header.value]));
}

describe("Vercel security headers", () => {
  it("pins the full Content-Security-Policy", () => {
    const csp = loadHeaderMap().get("Content-Security-Policy");

    expect(csp).toBe(
      "default-src 'self'; form-action 'self'; img-src 'self' data:; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'sha256-slPIjW6f9kQGAZ7Nr5zvZTUFLfWwqk+Nz+D9vWJHy1g='; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
  });

  it("keeps the inline theme-init script hash in sync with index.html", async () => {
    const { createHash } = await import("node:crypto");
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(inline, "index.html must contain the inline theme-init script").toBeTruthy();

    const hash = createHash("sha256").update(inline ?? "", "utf8").digest("base64");
    expect(loadHeaderMap().get("Content-Security-Policy")).toContain(`'sha256-${hash}'`);
  });

  it("keeps image CSP limited to same-origin and data images", () => {
    const csp = loadHeaderMap().get("Content-Security-Policy");

    expect(csp).toContain("img-src 'self' data:");
    expect(csp).not.toMatch(/img-src[^;]*https:/);
  });

  it("sets the hardening headers", () => {
    const headers = loadHeaderMap();

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("denies unused browser features via Permissions-Policy", () => {
    const policy = loadHeaderMap().get("Permissions-Policy") ?? "";

    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb", "bluetooth", "serial", "idle-detection", "screen-wake-lock"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });
});
