"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { AgentResult, BaselineResult, Confidence } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* The required eight-field output, rendered as the product's primary artefact.
   The plain-text version is one copy away, because that is the format the brief
   asks for and the format a judge will want to paste somewhere. */

const CONFIDENCE_TONE: Record<Confidence, "success" | "warn" | "danger"> = {
  High: "success",
  Medium: "warn",
  Low: "danger",
};

export function AgentCard({
  result,
  variant = "agent",
  className,
}: {
  result: AgentResult | BaselineResult;
  variant?: "agent" | "shallow";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { card } = result;
  const shallow = variant === "shallow";

  const copy = async () => {
    await navigator.clipboard.writeText(result.formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const rows: { label: string; value: string; emphasis?: boolean }[] = [
    { label: "Current reel", value: card.currentReel },
    { label: "Interest detected", value: card.interestDetected, emphasis: true },
    { label: "Why", value: card.why },
    { label: "Recommended tech reel", value: card.recommendedTechReel, emphasis: true },
    { label: "Category", value: card.category },
    { label: "Why this recommendation", value: card.whyThisRecommendation },
  ];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-surface",
        shallow ? "border-line-strong" : "border-primary-200 shadow-lg",
        className,
      )}
      aria-label={shallow ? "Baseline output" : "Upstream agent output"}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-4 border-b px-5 py-3.5",
          shallow ? "border-line bg-surface-2/50" : "border-primary-200/70 bg-primary-100/40",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2 rounded-full",
              shallow ? "bg-fg-subtle" : "bg-primary-500 animate-pulse-dot",
            )}
            aria-hidden
          />
          <h2 className={cn("text-eyebrow", shallow ? "text-fg-subtle" : "text-primary-600")}>
            {shallow ? "Keyword baseline" : "Upstream agent"}
          </h2>
        </div>

        <button
          type="button"
          onClick={copy}
          className="focus-ring inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-mono-xs text-fg-subtle transition-colors hover:text-fg"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "copied" : "copy block"}
        </button>
      </header>

      <dl className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[190px_1fr] sm:gap-5">
            <dt className="text-mono-xs uppercase text-fg-subtle">{row.label}</dt>
            <dd
              className={cn(
                "text-[14px] leading-6 text-fg",
                row.emphasis && (shallow ? "font-medium" : "font-medium text-primary-600"),
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-mono-xs uppercase text-fg-subtle">Difficulty</span>
            <Badge tone="neutral">{card.difficulty}</Badge>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-mono-xs uppercase text-fg-subtle">Confidence</span>
            <Badge tone={shallow ? "neutral" : CONFIDENCE_TONE[card.confidence]}>
              {card.confidence}
            </Badge>
          </div>
        </div>
      </dl>
    </section>
  );
}
