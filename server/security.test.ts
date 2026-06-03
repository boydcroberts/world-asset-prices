import { describe, expect, it } from "vitest";

import { isAllowedLogoHost, isPrivateHost, parseAndValidateLogoUrl } from "./security";

describe("security helpers", () => {
  it("allows known logo hosts", () => {
    expect(isAllowedLogoHost("static.coinpaprika.com")).toBe(true);
    expect(isAllowedLogoHost("cryptoicons.org")).toBe(true);
  });

  it("rejects localhost and private hosts", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.0.0.9")).toBe(true);
    expect(isAllowedLogoHost("localhost")).toBe(false);
  });

  it("rejects bracketed and extended IPv6 private literals", () => {
    expect(isPrivateHost("[::1]")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("[fc00::1]")).toBe(true);
    expect(isPrivateHost("[fe80::1]")).toBe(true);
    expect(isPrivateHost("[fec0::1]")).toBe(true);
    expect(isPrivateHost("[ff02::1]")).toBe(true);
    expect(isPrivateHost("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateHost("[192.168.1.1]")).toBe(true);
  });

  it("does not treat lookalike public hostnames as private", () => {
    expect(isPrivateHost("fc.example.com")).toBe(false);
    expect(isPrivateHost("ff.example.com")).toBe(false);
    expect(isPrivateHost("static.coinpaprika.com")).toBe(false);
  });

  it("rejects invalid protocols and unlisted domains", () => {
    expect(parseAndValidateLogoUrl("file:///tmp/a.png").reason).toBe("invalid_protocol");
    expect(parseAndValidateLogoUrl("https://evil.example.com/logo.png").reason).toBe("host_not_allowed");
  });

  it("rejects logo URLs with username or password components", () => {
    expect(parseAndValidateLogoUrl("https://user:secret@static.coinpaprika.com/coin/btc-bitcoin/logo.png").reason).toBe(
      "userinfo_not_allowed",
    );
  });

  it("accepts valid https logo URLs from allowlist", () => {
    const result = parseAndValidateLogoUrl("https://static.coinpaprika.com/coin/btc-bitcoin/logo.png");
    expect(result.reason).toBeNull();
    expect(result.url?.hostname).toBe("static.coinpaprika.com");
  });
});
