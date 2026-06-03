const DEFAULT_ALLOWED_LOGO_HOSTS = [
  "static.coinpaprika.com",
  "cryptoicons.org",
  "cryptoicon-api.pages.dev",
  "financialmodelingprep.com",
  "images.financialmodelingprep.com",
  "flagcdn.com",
];

function isIpv4Private(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 0) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  return false;
}

// URL.hostname wraps IPv6 literals in brackets (e.g. "[::1]"); strip them so the
// literal-IP checks below see the bare address. Without this, "[::1]" / "[fc00::1]"
// slip past the private-range checks.
function stripIpv6Brackets(hostname: string): string {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function isIpv6Private(hostname: string): boolean {
  const normalized = stripIpv6Brackets(hostname.toLowerCase());
  // Only IPv6 literals are relevant here, and they always contain a colon. Gating
  // on this avoids false positives like "fc.example.com" being read as a ULA.
  if (!normalized.includes(":")) {
    return false;
  }

  if (
    normalized === "::1" || // loopback
    normalized === "::" || // unspecified
    normalized.startsWith("fc") || // unique-local fc00::/7
    normalized.startsWith("fd") || // unique-local fc00::/7
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fec0:") || // deprecated site-local
    normalized.startsWith("ff") // multicast ff00::/8
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — validate the embedded IPv4.
  const mapped = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    return isIpv4Private(mapped[1]);
  }

  return false;
}

export function isPrivateHost(hostname: string): boolean {
  const normalized = stripIpv6Brackets(hostname.trim().toLowerCase());
  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized.endsWith(".local")) {
    return true;
  }

  if (isIpv4Private(normalized) || isIpv6Private(normalized)) {
    return true;
  }

  return false;
}

function getAllowedLogoHosts(): string[] {
  const raw = process.env.LOGO_ALLOWED_HOSTS;
  if (!raw) {
    return DEFAULT_ALLOWED_LOGO_HOSTS;
  }

  const hosts = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return hosts.length > 0 ? hosts : DEFAULT_ALLOWED_LOGO_HOSTS;
}

export function isAllowedLogoHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || isPrivateHost(normalized)) {
    return false;
  }

  return getAllowedLogoHosts().some((host) => normalized === host);
}

export function parseAndValidateLogoUrl(value: string | null): { url: URL | null; reason: string | null } {
  if (!value) {
    return { url: null, reason: "missing_url" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { url: null, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:") {
    return { url: null, reason: "invalid_protocol" };
  }

  if (parsed.username || parsed.password) {
    return { url: null, reason: "userinfo_not_allowed" };
  }

  if (!isAllowedLogoHost(parsed.hostname)) {
    return { url: null, reason: "host_not_allowed" };
  }

  return { url: parsed, reason: null };
}
