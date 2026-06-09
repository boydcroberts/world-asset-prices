import { useEffect, useMemo, useRef, useState, memo } from "react";
import clsx from "clsx";

import { LogoMark } from "./LogoMark";
import type { DashboardEntry } from "../lib/dashboard-insights";

type SearchModalProps = {
  entries: DashboardEntry[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

const MAX_RESULTS = 8;

function normalizeQ(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Returns 0 (best) → 6 (weakest) match quality, or Infinity for no match. */
function matchScore(entry: DashboardEntry, query: string): number {
  if (!query) return 0; // all pass when empty
  const q = normalizeQ(query);
  const sym = normalizeQ(entry.symbol ?? "");
  const name = normalizeQ(entry.name);
  const cat = normalizeQ(entry.category ?? "");
  if (sym === q || name === q) return 0;
  if (sym.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (sym.includes(q)) return 3;
  if (name.includes(q)) return 4;
  if (cat.includes(q)) return 5;
  return Infinity;
}

export const SearchModal = memo(function SearchModal({ entries, onSelect, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [rawCursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    return entries
      .map((e) => ({ entry: e, score: matchScore(e, query) }))
      .filter((r) => r.score < Infinity)
      .sort((a, b) => a.score - b.score || (a.entry.rank ?? 999) - (b.entry.rank ?? 999))
      .slice(0, MAX_RESULTS)
      .map((r) => r.entry);
  }, [entries, query]);

  // Clamp instead of resetting via effect — results can shrink while the
  // modal is open (background refetch) and a reset effect costs a render.
  const cursor = Math.min(rawCursor, Math.max(0, results.length - 1));

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[cursor] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function handleSelect(id: string) {
    onSelect(id);
    onClose();
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setCursor(0);
  }

  function handleInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setCursor(Math.min(cursor + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setCursor(Math.max(cursor - 1, 0));
        break;
      case "Enter":
        if (results[cursor]) handleSelect(results[cursor].id);
        break;
      case "Escape":
        onClose();
        break;
    }
  }

  return (
    <div
      className="search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search all assets"
      onClick={onClose}
    >
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Input row */}
        <div className="search-input-row">
          <svg className="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search assets…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleInputKey}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={results[cursor] ? `search-result-${results[cursor].id}` : undefined}
          />
          <kbd className="search-esc-hint" aria-label="Press Escape to close">esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul
            id="search-results"
            ref={listRef}
            className="search-results"
            role="listbox"
            aria-label="Search results"
          >
            {results.map((entry, i) => (
              <li
                key={entry.id}
                id={`search-result-${entry.id}`}
                role="option"
                aria-selected={i === cursor}
                className={clsx("search-result", i === cursor && "search-result--active")}
                onMouseEnter={() => setCursor(i)}
                onClick={() => handleSelect(entry.id)}
              >
                <LogoMark
                  name={entry.name}
                  symbol={entry.symbol ?? ""}
                  logoUrl={entry.logoUrl ?? null}
                  fallbackLogoUrls={"fallbackLogoUrls" in entry ? entry.fallbackLogoUrls : []}
                />
                <span className="search-result-name">{entry.name}</span>
                {entry.symbol ? (
                  <span className="search-result-symbol">{entry.symbol}</span>
                ) : null}
                <span className="search-result-cat">{entry.category}</span>
                <span className="search-result-rank" aria-hidden="true">#{entry.rank}</span>
              </li>
            ))}
          </ul>
        ) : query ? (
          <p className="search-empty">No results for "<strong>{query}</strong>"</p>
        ) : null}

        {/* Footer hint */}
        <div className="search-footer" aria-hidden="true">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
});
