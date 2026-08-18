"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Creator, Reel } from "@/lib/types";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { StoryViewer } from "./story-viewer";

export function uniqueCreators(reels: Reel[]): Creator[] {
  const seen = new Set<string>();
  const out: Creator[] = [];
  for (const reel of reels) {
    if (seen.has(reel.creator.handle)) continue;
    seen.add(reel.creator.handle);
    out.push(reel.creator);
  }
  return out;
}

export function StoriesRail({
  reels,
  selfName,
  seen,
  onSeen,
}: {
  reels: Reel[];
  selfName: string;
  seen: Set<string>;
  onSeen: (handle: string) => void;
}) {
  const [openHandle, setOpenHandle] = useState<string | null>(null);
  const creators = uniqueCreators(reels).slice(0, 16);
  const openIndex = creators.findIndex((c) => c.handle === openHandle);

  return (
    <>
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-1 py-3">
        <button type="button" className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
          <span className="relative">
            <Avatar name={selfName} hue={24} size={66} />
            <span className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full border-2 border-bg bg-[#0095f6] text-white">
              <Plus className="size-3" strokeWidth={3} aria-hidden />
            </span>
          </span>
          <span className="w-full truncate text-center text-[12px] text-fg">Your story</span>
        </button>

        {creators.map((creator) => {
          const isSeen = seen.has(creator.handle);
          return (
            <button
              key={creator.handle}
              type="button"
              onClick={() => setOpenHandle(creator.handle)}
              className="flex w-[74px] shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "rounded-full p-[2.5px]",
                  isSeen ? "ig-story-ring-seen" : "ig-story-ring",
                )}
              >
                <span className="block rounded-full bg-bg p-[2px]">
                  <Avatar name={creator.name} hue={creator.hue} size={58} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[12px] text-fg">
                {creator.handle.replace(/^@/, "")}
              </span>
            </button>
          );
        })}
      </div>

      {openHandle && openIndex >= 0 && (
        <StoryViewer
          key={openHandle}
          reels={reels}
          creators={creators}
          startIndex={openIndex}
          onClose={() => setOpenHandle(null)}
          onSeen={onSeen}
        />
      )}
    </>
  );
}
