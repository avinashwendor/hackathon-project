"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import type { Reel } from "@/lib/types";
import { reelThumbnailSrc, ReelThumbnail } from "@/components/catalog/reel-thumbnail";

function ReelGrid({ reels }: { reels: Reel[] }) {
  return (
    <div className="grid grid-cols-3 gap-[2px] lg:gap-1">
      {reels.map((reel, i) => (
        <Link
          key={reel.id}
          href={`/reels?reel=${encodeURIComponent(reel.id)}`}
          className={i % 12 === 2 ? "row-span-2" : ""}
        >
          <ReelThumbnail
            reel={reel}
            className={
              i % 12 === 2
                ? "h-full min-h-[240px] w-full rounded-none"
                : "aspect-square w-full rounded-none"
            }
          />
        </Link>
      ))}
    </div>
  );
}

export function ExploreExperience({
  initialReels,
  feedSource,
}: {
  initialReels: Reel[];
  feedSource?: string;
}) {
  const playable = initialReels.filter((r) => reelThumbnailSrc(r));
  const [query, setQuery] = useState("");
  const [display, setDisplay] = useState(playable);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"browse" | "search">("browse");

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setMode("search");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=24`);
      const json = (await res.json()) as {
        results?: { reel: Reel; blocked?: boolean }[];
      };
      setDisplay(
        (json.results ?? [])
          .filter((r) => !r.blocked && reelThumbnailSrc(r.reel))
          .map((r) => r.reel),
      );
    } catch {
      setDisplay([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="border-b border-line px-4 py-4 lg:px-8">
        <form onSubmit={(e) => void search(e)} className="mx-auto flex max-w-[935px] gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Semantic search — e.g. Java concurrency, RAG, system design"
              className="w-full rounded-lg border border-line bg-surface py-2.5 pr-3 pl-10 text-[14px] outline-none focus:border-[#0095f6]"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="rounded-lg bg-[#0095f6] px-5 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </button>
          {mode === "search" && (
            <button
              type="button"
              onClick={() => {
                setMode("browse");
                setQuery("");
                setDisplay(playable);
              }}
              className="rounded-lg border border-line px-4 text-[14px] font-medium"
            >
              Clear
            </button>
          )}
        </form>
        {mode === "browse" && feedSource && (
          <p className="mx-auto mt-2 max-w-[935px] text-[12px] text-fg-subtle">
            Picked for you · {feedSource}
          </p>
        )}
        {mode === "search" && (
          <p className="mx-auto mt-2 max-w-[935px] text-[12px] text-fg-subtle">
            {display.length} results · vector semantic search
          </p>
        )}
      </div>

      <div className="mx-auto max-w-[935px] px-0 py-0 lg:px-8 lg:py-4">
        {display.length ? (
          <ReelGrid reels={display} />
        ) : (
          <p className="py-12 text-center text-[14px] text-fg-muted">No reels matched.</p>
        )}
      </div>
    </>
  );
}
