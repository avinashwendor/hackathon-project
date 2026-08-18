import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* The abstraction ladder, drawn. This is the single idea that separates the
   agent from keyword matching, so the landing page shows it rather than
   claiming it. */

const RUNGS = [
  {
    level: "Surface",
    label: "“Java”",
    body: "What the reels literally are. A meme, a joke, a day-in-the-life, a laptop review. One shared word between them — and the laptop reel does not even have that.",
    tone: "muted" as const,
  },
  {
    level: "Domain",
    label: "Software engineering craft",
    body: "The field that contains all four. Not a word they share — a vantage point they share. This is the rung a keyword recommender can never reach.",
    tone: "signal" as const,
  },
  {
    level: "Motivation",
    label: "Orienting toward a first engineering job",
    body: "Why a person watches this exact set, this week. The laptop reel is the tell: nobody researches a dev machine for a joke.",
    tone: "primary" as const,
  },
];

export function Ladder({ className }: { className?: string }) {
  return (
    <ol className={cn("relative space-y-3", className)}>
      {RUNGS.map((rung, i) => (
        <li
          key={rung.level}
          className="relative"
          style={{ marginLeft: `${i * 6}%` }}
        >
          <div
            className={cn(
              "rounded-lg border p-5 transition-shadow sm:p-6",
              rung.tone === "primary" && "border-primary-200 bg-primary-100/50 shadow-md",
              rung.tone === "signal" && "border-signal-300/50 bg-signal-100/45",
              rung.tone === "muted" && "border-line bg-surface",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={cn(
                  "text-mono-xs uppercase",
                  rung.tone === "primary" ? "text-primary-600" : rung.tone === "signal" ? "text-signal-600" : "text-fg-subtle",
                )}
              >
                {String(i + 1).padStart(2, "0")} · {rung.level}
              </span>
              <span className="text-heading-3 font-semibold text-fg">{rung.label}</span>
            </div>
            <p className="mt-2.5 max-w-[62ch] text-body-lg text-fg-muted">{rung.body}</p>
          </div>

          {i < RUNGS.length - 1 && (
            <span
              className="ml-8 flex h-8 w-8 items-center justify-center text-fg-subtle"
              aria-hidden
            >
              <ArrowUp className="size-4" strokeWidth={2.2} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
