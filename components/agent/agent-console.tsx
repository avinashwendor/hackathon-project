"use client";

import { useEffect, useState } from "react";
import { Play, RotateCw, Sparkles } from "lucide-react";
import type { Scenario } from "@/data/scenarios";
import type { Reel } from "@/lib/types";
import { ReelTile } from "@/components/catalog/reel-tile";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { AgentCard } from "./agent-card";
import { Diagnostics, InferencePanel, RejectedList, StageList } from "./trace";
import { useAgentRun } from "./use-agent-run";

type Tab = "reasoning" | "refused" | "shortlist";

export function AgentConsole({
  scenarios,
  reelsById,
}: {
  scenarios: Scenario[];
  reelsById: Record<string, Reel>;
}) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "the-trap");
  const [tab, setTab] = useState<Tab>("reasoning");
  const { status, stages, result, error, run } = useAgentRun();

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  // Run the trap scenario on arrival: an empty console teaches nobody anything.
  useEffect(() => {
    void run({ scenarioId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  const currentReel = scenario ? reelsById[scenario.currentReelId] : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-12">
      {/* ── Controls ─────────────────────────────────────────────────── */}
      <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
        <div>
          <h2 className="text-eyebrow text-fg-subtle">Watch history</h2>
          <div className="mt-4 space-y-2">
            {scenarios.map((item) => {
              const active = item.id === scenarioId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScenarioId(item.id)}
                  aria-pressed={active}
                  className={cn(
                    "focus-ring w-full rounded-md border p-4 text-left transition-colors",
                    active
                      ? "border-primary-300 bg-primary-100/50"
                      : "border-line bg-surface hover:bg-surface-2/60",
                  )}
                >
                  <p className={cn("text-[14px] font-medium", active ? "text-primary-700" : "text-fg")}>
                    {item.name}
                  </p>
                  <p className="mt-1 text-small text-fg-muted">{item.tagline}</p>
                </button>
              );
            })}
          </div>
        </div>

        {scenario && (
          <Card className="gap-3 bg-surface-2/40">
            <h3 className="text-eyebrow text-fg-subtle">The setup</h3>
            <p className="text-body text-fg-muted">{scenario.premise}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {scenario.history.map((step) => {
                const reel = reelsById[step.reelId];
                if (!reel) return null;
                const positive = step.completion >= 0.5 || step.liked || step.saved;
                return (
                  <Chip key={step.reelId} tone={positive ? "success" : "danger"}>
                    {reel.title.length > 26 ? `${reel.title.slice(0, 26)}…` : reel.title}
                    <span className="opacity-70">{Math.round(step.completion * 100)}%</span>
                  </Chip>
                );
              })}
            </div>
          </Card>
        )}

        <Button
          onClick={() => void run({ scenarioId, allowRepeat: true })}
          disabled={status === "running"}
          className="w-full"
          leadingIcon={
            status === "running" ? (
              <RotateCw className="size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="size-4 fill-current" strokeWidth={0} aria-hidden />
            )
          }
        >
          {status === "running" ? "Reasoning…" : "Run the agent again"}
        </Button>

        {currentReel && (
          <div>
            <h2 className="text-eyebrow text-fg-subtle">Currently watching</h2>
            <ReelTile reel={currentReel} className="mt-4" />
          </div>
        )}
      </aside>

      {/* ── Output ───────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-8">
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger">
            {error}
          </div>
        )}

        {result ? (
          <AgentCard result={result} />
        ) : (
          <div className="rounded-lg border border-line bg-surface p-8">
            <div className="flex items-center gap-3 text-fg-muted">
              <Sparkles className="size-4 animate-pulse-dot text-primary-500" aria-hidden />
              <p className="text-body">
                Reading the behaviour, climbing the ladder, and refusing the hype…
              </p>
            </div>
            <div className="mt-6 space-y-3">
              {[92, 74, 88, 60].map((w, i) => (
                <div
                  key={i}
                  className="h-3 overflow-hidden rounded-full bg-surface-2"
                  style={{ width: `${w}%` }}
                >
                  <div className="animate-sweep h-full w-1/3 bg-linear-to-r from-transparent via-primary-200 to-transparent" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live trace */}
        <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-eyebrow text-fg-subtle">Pipeline</h2>
          <StageList stages={stages} className="mt-4" />
        </section>

        {result && (
          <>
            <section className="rounded-lg border border-line bg-surface">
              <div className="flex gap-1 border-b border-line px-3 pt-3">
                {(
                  [
                    ["reasoning", "Reasoning"],
                    ["refused", `Refused (${result.rejected.length})`],
                    ["shortlist", `Shortlist (${result.runnersUp.length})`],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={cn(
                      "focus-ring -mb-px rounded-t-sm border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors",
                      tab === key
                        ? "border-primary-500 text-fg"
                        : "border-transparent text-fg-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5 sm:p-6">
                {tab === "reasoning" && <InferencePanel inference={result.inference} />}
                {tab === "refused" && (
                  <>
                    <p className="mb-4 text-body text-fg-muted">
                      Every candidate the guardrails removed, with the reason and the score it would
                      otherwise have had.
                    </p>
                    <RejectedList rejected={result.rejected} />
                  </>
                )}
                {tab === "shortlist" && (
                  <div className="space-y-3">
                    <p className="text-body text-fg-muted">
                      The runners-up the reranker considered, after diversity filtering.
                    </p>
                    {result.runnersUp.map((candidate) => (
                      <div key={candidate.reel.id}>
                        <ReelTile reel={candidate.reel} />
                        <p className="mt-1.5 px-1 text-mono-xs text-fg-subtle">
                          score {candidate.score.toFixed(3)} · similarity{" "}
                          {candidate.similarity.toFixed(3)} · taste fit {candidate.tasteFit.toFixed(3)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div>
              <h2 className="text-eyebrow text-fg-subtle">Run diagnostics</h2>
              <Diagnostics diagnostics={result.diagnostics} className="mt-4" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
