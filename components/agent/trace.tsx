"use client";

import { Check, CircleDashed, Loader2, X } from "lucide-react";
import type { AgentDiagnostics, AgentStage, InterestInference, RejectedCandidate } from "@/lib/types";
import { Badge, Chip, Meter } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   The reasoning trace.

   This is the half of the product that a normal feed refuses to show you: what
   it read, what it concluded, what it threw away and why. It is rendered from
   the same objects the API returns, so it cannot flatter the agent.
--------------------------------------------------------------------------- */

export function StageList({ stages, className }: { stages: AgentStage[]; className?: string }) {
  return (
    <ol className={cn("space-y-0", className)}>
      {stages.map((stage, i) => (
        <li
          key={stage.key}
          className={cn(
            "flex gap-4 py-3.5",
            i > 0 && "border-t border-line",
            stage.status === "running" && "animate-rise",
          )}
        >
          <span className="mt-0.5 shrink-0">
            {stage.status === "done" ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            ) : stage.status === "failed" ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-danger-soft text-danger">
                <X className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            ) : stage.status === "running" ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} aria-hidden />
              </span>
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-fg-subtle">
                <CircleDashed className="size-3.5" strokeWidth={2} aria-hidden />
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-[14px] font-medium text-fg">{stage.label}</h3>
              <span className="text-mono-xs text-fg-subtle">
                {stage.status === "running" ? "running…" : `${stage.ms}ms`}
              </span>
            </div>
            {stage.detail && <p className="mt-1 text-body text-fg-muted">{stage.detail}</p>}
            {stage.metrics && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(stage.metrics).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-xs bg-surface-2 px-2 py-1 text-mono-xs text-fg-muted"
                  >
                    {key} <span className="text-fg">{String(value)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function InferencePanel({
  inference,
  className,
}: {
  inference: InterestInference;
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      <div>
        <h3 className="text-eyebrow text-fg-subtle">The climb</h3>
        <ol className="mt-4 space-y-2">
          {inference.ladder.map((rung, i) => (
            <li
              key={rung.level}
              className={cn(
                "rounded-md border p-4",
                rung.level === "motivation"
                  ? "border-primary-200 bg-primary-100/40"
                  : rung.level === "domain"
                    ? "border-signal-300/40 bg-signal-100/40"
                    : "border-line bg-surface-2/40",
              )}
              style={{ marginLeft: `${i * 12}px` }}
            >
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-mono-xs uppercase text-fg-subtle">{rung.level}</span>
                <span className="text-[15px] font-medium text-fg">{rung.label}</span>
              </div>
              <p className="mt-1.5 text-body text-fg-muted">{rung.rationale}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="text-eyebrow text-fg-subtle">Evidence it leaned on</h3>
        <ul className="mt-4 space-y-2">
          {inference.evidence.map((item) => (
            <li
              key={item.reelId}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-fg">{item.title}</p>
                <p className="text-small text-fg-muted">{item.signal}</p>
              </div>
              <span
                className={cn(
                  "text-mono-xs tabular-nums",
                  item.weight >= 0 ? "text-success" : "text-danger",
                )}
              >
                {item.weight >= 0 ? "+" : ""}
                {item.weight.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {inference.avoid.length > 0 && (
        <div>
          <h3 className="text-eyebrow text-fg-subtle">What it refused to do</h3>
          <ul className="mt-4 space-y-2">
            {inference.avoid.map((item) => (
              <li key={item} className="flex gap-2.5 text-body text-fg-muted">
                <X className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={2.4} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={inference.breadthDetected ? "primary" : "neutral"}>
          {inference.breadthDetected ? "breadth detected" : "narrow interest"}
        </Chip>
        {inference.careerSignal && <Chip tone="signal">{inference.careerSignal}</Chip>}
        {inference.secondaryInterests.slice(0, 2).map((interest) => (
          <Chip key={interest}>{interest}</Chip>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-eyebrow text-fg-subtle">Confidence</h3>
          <span className="text-mono-xs text-fg-muted">
            {inference.confidence} · {(inference.confidenceScore * 100).toFixed(0)}%
          </span>
        </div>
        <Meter
          className="mt-3"
          value={inference.confidenceScore}
          tone={
            inference.confidence === "High"
              ? "success"
              : inference.confidence === "Medium"
                ? "primary"
                : "danger"
          }
        />
        <p className="mt-2 text-small text-fg-subtle">
          Capped by how much evidence exists — the model cannot talk itself into certainty the
          behaviour does not support.
        </p>
      </div>
    </div>
  );
}

const REASON_LABEL: Record<string, string> = {
  hype: "Hype",
  "low-substance": "Empty",
  "same-subtopic": "Too narrow",
  "already-seen": "Seen",
  "difficulty-mismatch": "Wrong level",
  "off-interest": "Off target",
  "duplicate-creator": "Same creator",
};

export function RejectedList({
  rejected,
  className,
}: {
  rejected: RejectedCandidate[];
  className?: string;
}) {
  if (!rejected.length) {
    return <p className={cn("text-body text-fg-muted", className)}>Nothing was refused this run.</p>;
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {rejected.map((item) => (
        <li
          key={item.reelId}
          className={cn(
            "rounded-md border px-4 py-3",
            item.reason === "hype"
              ? "border-danger/25 bg-danger-soft/50"
              : "border-line bg-surface",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <p className="text-[14px] font-medium text-fg line-through decoration-fg-subtle/40">
              {item.title}
            </p>
            <Badge tone={item.reason === "hype" ? "danger" : "neutral"}>
              {REASON_LABEL[item.reason] ?? item.reason}
            </Badge>
          </div>
          <p className="mt-1.5 text-small text-fg-muted">{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function Diagnostics({
  diagnostics,
  className,
}: {
  diagnostics: AgentDiagnostics;
  className?: string;
}) {
  const rows: [string, string][] = [
    ["model", diagnostics.llmUsed ? diagnostics.llmModel : "deterministic fallback"],
    ["embeddings", `${diagnostics.embeddingProvider} · ${diagnostics.embeddingDims}d`],
    ["vector store", diagnostics.vectorStore],
    ["candidates", `${diagnostics.candidatesRetrieved} kept · ${diagnostics.candidatesRejected} refused`],
    ["latency", `${diagnostics.totalMs}ms`],
    ...(diagnostics.tokens
      ? ([["tokens", `${diagnostics.tokens.prompt} in · ${diagnostics.tokens.completion} out`]] as [string, string][])
      : []),
  ];

  return (
    <div className={cn("rounded-md border border-line bg-surface-2/40 p-4", className)}>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="text-mono-xs text-fg-subtle">{key}</dt>
            <dd className="text-mono-xs text-right text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {diagnostics.degraded && (
        <p className="mt-3 border-t border-line pt-3 text-small text-warn">{diagnostics.degraded}</p>
      )}
    </div>
  );
}
