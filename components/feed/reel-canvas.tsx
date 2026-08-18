"use client";

import { useMemo } from "react";
import type { Reel } from "@/lib/types";
import { cn, seeded } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Generated reel surface.

   Every reel in the seed catalog is fictional, so there is no footage to play.
   Rather than grey placeholder boxes, each reel renders its own poster: a mesh
   gradient seeded from the creator's hue, drifting blobs, film grain and the
   title set as kinetic type.

   It is deterministic — the same reel always looks the same — and it is pure
   CSS, so a screen full of them costs nothing. The moment a reel has real
   media, ReelPlayer plays that instead and this becomes the poster frame.
--------------------------------------------------------------------------- */

interface Blob {
  x: number;
  y: number;
  size: number;
  hue: number;
  delay: number;
  duration: number;
}

export function ReelCanvas({
  reel,
  active = false,
  className,
}: {
  reel: Reel;
  active?: boolean;
  className?: string;
}) {
  const { from, to, angle } = reel.media.poster;

  const blobs = useMemo<Blob[]>(() => {
    const rand = seeded(reel.id);
    return Array.from({ length: 5 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      size: 36 + rand() * 46,
      hue: from + rand() * ((to - from + 360) % 360),
      delay: -rand() * 18,
      duration: 16 + rand() * 14,
    }));
  }, [reel.id, from, to]);

  return (
    <div
      className={cn("relative isolate h-full w-full overflow-hidden bg-ink-950", className)}
      style={{
        background: `linear-gradient(${angle}deg, hsl(${from} 62% 22%), hsl(${to} 58% 12%) 62%, hsl(${from} 40% 7%))`,
      }}
    >
      {/* Drifting colour field */}
      <div className="absolute inset-0" aria-hidden>
        {blobs.map((blob, i) => (
          <span
            key={i}
            className={cn(
              "absolute rounded-full blur-3xl",
              active ? "opacity-60" : "opacity-40",
            )}
            style={{
              left: `${blob.x}%`,
              top: `${blob.y}%`,
              width: `${blob.size}%`,
              aspectRatio: "1",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, hsl(${blob.hue % 360} 82% 56% / 0.55), transparent 68%)`,
              animation: active
                ? `upstream-pulse ${blob.duration}s ease-in-out ${blob.delay}s infinite`
                : undefined,
            }}
          />
        ))}
      </div>

      {/* Legibility scrim — the type sits on this, not on the gradient */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,8,0.92) 0%, rgba(10,9,8,0.32) 42%, rgba(10,9,8,0.12) 68%, rgba(10,9,8,0.55) 100%)",
        }}
      />

      <div className="grain-layer pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay" aria-hidden />

      {/* Kinetic type: the reel's own words are the artwork */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <p
          className={cn(
            "text-center font-display font-bold text-balance text-white/92 transition-all duration-700",
            active ? "translate-y-0 opacity-100 blur-0" : "translate-y-2 opacity-80 blur-[1px]",
          )}
          style={{
            fontSize: "clamp(20px, 6.2cqw, 34px)",
            lineHeight: 1.16,
            textShadow: "0 2px 30px rgba(0,0,0,0.45)",
            containerType: "inline-size",
          }}
        >
          {reel.title}
        </p>
      </div>

      {/* Waveform — moves only while the reel is the active one */}
      <div className="absolute inset-x-0 bottom-0 flex h-14 items-end gap-[3px] px-4 pb-3 opacity-45" aria-hidden>
        {Array.from({ length: 48 }, (_, i) => {
          const rand = seeded(`${reel.id}-${i}`);
          const height = 12 + rand() * 78;
          return (
            <span
              key={i}
              className="flex-1 rounded-full bg-white/70"
              style={{
                height: `${height}%`,
                animation: active ? `upstream-pulse ${1.1 + (i % 7) * 0.16}s ease-in-out ${i * 0.03}s infinite` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
