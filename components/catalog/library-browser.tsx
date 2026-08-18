"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { Category, Reel } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { ReelTile } from "@/components/catalog/reel-tile";
import { cn } from "@/lib/utils";

interface SearchResponse {
  results: { reel: Reel; score: number; blocked: boolean; blockReason: string | null }[];
  diagnostics: { provider: string; dims: number; store: string; indexed: number; ms: number };
}

const EXAMPLES = [
  "why is my docker build slow",
  "how do systems stay consistent when the network splits",
  "I keep freezing in interviews",
  "what actually happens under my for loop",
];

export function LibraryBrowser({ reels }: { reels: Reel[] }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string, cat: Category | "All") => {
    if (!q.trim()) {
      setResults(null);
      setSubmitted("");
      return;
    }
    setLoading(true);
    setSubmitted(q);
    try {
      const params = new URLSearchParams({ q, limit: "12" });
      if (cat !== "All") params.set("category", cat);
      const res = await fetch(`/api/search?${params}`);
      setResults(res.ok ? ((await res.json()) as SearchResponse) : null);
    } finally {
      setLoading(false);
    }
  }, []);

  const browsed = useMemo(
    () => (category === "All" ? reels : reels.filter((r) => r.category === category)),
    [reels, category],
  );

  const showing = results?.results.map((r) => r.reel) ?? browsed;
  const hitById = new Map(results?.results.map((r) => [r.reel.id, r]) ?? []);

  return (
    <div className="space-y-8">
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query, category);
        }}
        className="space-y-4"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-fg-subtle"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you want to understand, in plain English…"
            aria-label="Search the catalog"
            className="focus-ring h-16 w-full rounded-md border border-line-strong bg-surface pr-28 pl-14 text-[16px] text-fg placeholder:text-fg-subtle focus:border-primary-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(null);
                setSubmitted("");
              }}
              className="focus-ring absolute top-1/2 right-20 -translate-y-1/2 rounded-full p-1.5 text-fg-subtle hover:text-fg"
              aria-label="Clear"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="submit"
            className="focus-ring absolute top-1/2 right-3 -translate-y-1/2 rounded-sm bg-primary-500 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-primary-600"
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-mono-xs text-fg-subtle">try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                void search(example, category);
              }}
              className="focus-ring rounded-full border border-line px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-primary-300 hover:text-primary-600"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 border-y border-line py-4">
        {(["All", ...CATEGORIES] as (Category | "All")[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setCategory(item);
              if (submitted) void search(submitted, item);
            }}
            aria-pressed={category === item}
            className={cn(
              "focus-ring rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              category === item
                ? "bg-fg text-[var(--color-bg)]"
                : "bg-surface-2 text-fg-muted hover:text-fg",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Result meta */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-body text-fg-muted">
          {results
            ? `${showing.length} semantic matches for “${submitted}”${
                results.results.filter((r) => r.blocked).length
                  ? ` · ${results.results.filter((r) => r.blocked).length} the agent would refuse`
                  : ""
              }`
            : `${showing.length} reels${category === "All" ? "" : ` in ${category}`}`}
        </p>
        {results && (
          <p className="text-mono-xs text-fg-subtle">
            {results.diagnostics.provider} · {results.diagnostics.dims}d ·{" "}
            {results.diagnostics.store} · {results.diagnostics.ms}ms
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {showing.map((reel) => {
          const hit = hitById.get(reel.id);
          return (
            <div key={reel.id}>
              <ReelTile reel={reel} highlight={Boolean(hit) && !hit!.blocked} blocked={hit?.blocked} />
              {hit && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 px-1 text-mono-xs">
                  <span className="text-fg-subtle">cosine {hit.score.toFixed(4)}</span>
                  {hit.blocked && (
                    <span className="text-danger">
                      refused by the agent — {hit.blockReason}
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {showing.length === 0 && (
        <p className="rounded-lg border border-line bg-surface p-10 text-center text-body text-fg-muted">
          Nothing matched. Try describing the problem rather than naming the technology.
        </p>
      )}
    </div>
  );
}
