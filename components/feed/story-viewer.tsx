"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import type { Creator, Reel } from "@/lib/types";
import { ReelPlayer } from "./reel-player";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function StoryViewer({
  reels,
  creators,
  startIndex,
  onClose,
  onSeen,
}: {
  reels: Reel[];
  creators: Creator[];
  startIndex: number;
  onClose: () => void;
  onSeen: (handle: string) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const creator = creators[index];
  const slides = useMemo(
    () => (creator ? reels.filter((r) => r.creator.handle === creator.handle).slice(0, 4) : []),
    [reels, creator],
  );
  const [slide, setSlide] = useState(0);
  const current = slides[slide];

  useEffect(() => {
    if (creator) onSeen(creator.handle);
  }, [creator, onSeen]);

  useEffect(() => {
    if (!current) return;
    const ms = Math.min(Math.max(current.durationSec, 4), 8) * 1000;
    const timer = window.setTimeout(() => {
      if (slide < slides.length - 1) setSlide((s) => s + 1);
      else if (index < creators.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [current, slide, slides.length, index, creators.length, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const goNext = () => {
    if (slide < slides.length - 1) setSlide((s) => s + 1);
    else if (index < creators.length - 1) setIndex((i) => i + 1);
    else onClose();
  };

  const goPrev = () => {
    if (slide > 0) setSlide((s) => s - 1);
    else if (index > 0) setIndex((i) => i - 1);
  };

  if (!creator || !current) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close stories"
        className="absolute top-4 right-4 z-10 rounded-full p-2 text-white"
      >
        <X className="size-7" />
      </button>

      <div className="relative h-[min(100dvh,860px)] w-full max-w-[420px] overflow-hidden bg-black sm:rounded-xl">
        <div className="absolute top-3 right-3 left-3 z-10 flex gap-1">
          {slides.map((_, i) => (
            <span key={i} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className={cn("block h-full bg-white", i < slide && "w-full", i > slide && "w-0")}
                style={
                  i === slide
                    ? {
                        width: "100%",
                        animation: `ig-story-progress ${Math.min(Math.max(current.durationSec, 4), 8)}s linear`,
                      }
                    : undefined
                }
              />
            </span>
          ))}
        </div>

        <div className="absolute top-7 right-3 left-3 z-10 flex items-center gap-2 pt-2">
          <Avatar name={creator.name} hue={creator.hue} size={32} />
          <span className="text-[13px] font-semibold text-white">{creator.handle}</span>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="ml-auto rounded-full bg-black/40 p-2 text-white"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        <ReelPlayer reel={current} active muted={muted} className="absolute inset-0" />

        <button
          type="button"
          aria-label="Previous story"
          onClick={goPrev}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          aria-label="Next story"
          onClick={goNext}
          className="absolute inset-y-0 right-0 w-1/3"
        />
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous person"
          className="absolute left-4 hidden rounded-full bg-white/10 p-2 text-white lg:flex"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      {index < creators.length - 1 && (
        <button
          type="button"
          onClick={goNext}
          aria-label="Next person"
          className="absolute right-4 hidden rounded-full bg-white/10 p-2 text-white lg:flex"
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>
  );
}
