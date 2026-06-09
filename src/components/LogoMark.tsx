import { memo, useEffect, useMemo, useState } from "react";

import { normalizeMonogram } from "../lib/monogram";

type LogoMarkProps = {
  name: string;
  symbol: string;
  logoUrl?: string | null;
  fallbackLogoUrls?: string[];
};

const IS_GITHUB_PAGES = typeof __GITHUB_PAGES__ !== "undefined" && __GITHUB_PAGES__;

function toSafeLogoSource(source: string): string | null {
  const trimmed = source.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return null;
    }

    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function logoSourceUrl(source: string): string {
  if (!import.meta.env.PROD) {
    return source;
  }

  return `/api/logo?url=${encodeURIComponent(source)}`;
}

export const LogoMark = memo(function LogoMark({ name, symbol, logoUrl, fallbackLogoUrls = [] }: LogoMarkProps) {
  const [logoIndex, setLogoIndex] = useState(0);

  const sources = useMemo(
    () =>
      IS_GITHUB_PAGES
        ? []
        : [logoUrl, ...fallbackLogoUrls]
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map(toSafeLogoSource)
          .filter((item): item is string => item !== null),
    [fallbackLogoUrls, logoUrl],
  );

  useEffect(() => {
    setLogoIndex(0);
  }, [sources, symbol]);

  const currentSource = sources[logoIndex];

  if (!currentSource) {
    return (
      <span className="logo-fallback" aria-hidden="true">
        {normalizeMonogram(symbol)}
      </span>
    );
  }

  return (
    <img
      src={logoSourceUrl(currentSource)}
      alt={`${name} logo`}
      className="asset-logo"
      loading="lazy"
      decoding="async"
      width={28}
      height={28}
      onError={() => {
        setLogoIndex((previous) => previous + 1);
      }}
    />
  );
});
