"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, RotateCw } from "lucide-react";
import type { Scenario } from "@/data/scenarios";
import type { AgentResult, BaselineResult, Reel } from "@/lib/types";
import { ReelTile } from "@/components/catalog/reel-tile";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";
import { AgentCard } from "./agent-card";

interface CompareResponse {
  scenario: Pick<Scenario, "id" | "name" | "tagline" | "premise" | "shallowTrap">;
  currentReel: Reel;
  agent: AgentResult;
  shallow: BaselineResult;
}

type Outcome =
  | { ok: true; data: CompareResponse }
  | { ok: false; error: string };

async function fetchComparison(scenarioId: string): Promise<Outcome> {
  try {
    const res = await fetch("/api/agent/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
    });
    if (!res.ok) return { ok: false, error: `Comparison failed (${res.status})` };
    return { ok: true, data: (await res.json()) as CompareResponse };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export function Comparison({ scenarios }: { scenarios: Scenario[] }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "the-trap");
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to force a re-run of the same scenario. */
  const [nonce, setNonce] = useState(0);

  // The fetch helper is pure — it never touches state — so every setState below
  // happens after an await, and a scenario switch cancels the run in flight.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const outcome = await fetchComparison(scenarioId);
      if (cancelled) return;
      if (outcome.ok) setData(outcome.data);
      else setError(outcome.error);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scenarioId, nonce]);

  const sameAsCurrent =
    data && data.shallow.recommendation.topics.some((t) => data.currentReel.topics.includes(t));

  return (
    <div className="space-y-10">
      {/* Scenario picker */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => {
          const active = scenario.id === scenarioId;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                if (scenario.id === scenarioId) return;
                setLoading(true);
                setData(null);
                setScenarioId(scenario.id);
              }}
              aria-pressed={active}
              className={cn(
                "focus-ring rounded-full border px-4 py-2 text-[14px] font-medium transition-colors",
                active
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-line-strong bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {scenario.name}
            </button>
          );
        })}
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            setLoading(true);
            setNonce((n) => n + 1);
          }}
          disabled={loading}
          leadingIcon={<RotateCw className={cn("size-4", loading && "animate-spin")} aria-hidden />}
        >
          Re-run
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger">
          {error}
        </div>
      )}

      {data && (
        <>
          <Card className="gap-4 border-line bg-surface-2/40 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="primary">Scenario</Badge>
              <h2 className="text-heading-2 text-fg">{data.scenario.name}</h2>
            </div>
            <p className="max-w-[80ch] text-body-lg text-fg-muted">{data.scenario.premise}</p>
            <div className="mt-2 border-t border-line pt-4">
              <p className="text-eyebrow text-fg-subtle">Currently watching</p>
              <ReelTile reel={data.currentReel} className="mt-3 max-w-2xl" />
            </div>
          </Card>

          {/* The two answers */}
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle className="size-4" strokeWidth={2.2} aria-hidden />
                </span>
                <h3 className="text-heading-3 font-semibold text-fg">What a shallow system does</h3>
              </div>
              <p className="text-body text-fg-muted">{data.scenario.shallowTrap}</p>
              <AgentCard result={data.shallow} variant="shallow" />

              <Card className="gap-3 border-danger/25 bg-danger-soft/40">
                <h4 className="text-eyebrow text-danger">What it got wrong</h4>
                <ul className="space-y-2">
                  {data.shallow.critique.map((line) => (
                    <li key={line} className="flex gap-2.5 text-body text-fg">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-mono-xs text-fg-muted">method: {data.shallow.method}</p>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                </span>
                <h3 className="text-heading-3 font-semibold text-fg">What Upstream does</h3>
              </div>
              <p className="text-body text-fg-muted">
                Same history, same catalog, same moment. The difference is that this one read the
                behaviour instead of the vocabulary.
              </p>
              <AgentCard result={data.agent} />

              <Card className="gap-3 border-success/25 bg-success-soft/40">
                <h4 className="text-eyebrow text-success">What changed</h4>
                <ul className="space-y-2 text-body text-fg">
                  <li className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    Climbed to <strong className="font-medium">{data.agent.inference.primaryInterest}</strong>{" "}
                    instead of stopping at the shared keyword.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    Refused {data.agent.rejected.filter((r) => r.reason === "hype").length} hype
                    candidate(s) and {data.agent.rejected.filter((r) => r.reason === "same-subtopic").length}{" "}
                    same-topic repeat(s) before ranking.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    Reported {data.agent.card.confidence} confidence from{" "}
                    {data.agent.inference.evidence.length} pieces of behavioural evidence, not from
                    keyword count.
                  </li>
                </ul>
              </Card>
            </div>
          </div>

          {/* Verdict strip */}
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <VerdictCell
                label="Interest detected"
                shallow={data.shallow.card.interestDetected}
                agent={data.agent.card.interestDetected}
              />
              <VerdictCell
                label="Recommended"
                shallow={data.shallow.card.recommendedTechReel}
                agent={data.agent.card.recommendedTechReel}
              />
              <VerdictCell
                label="Substance of the pick"
                shallow={data.shallow.recommendation.substance.toFixed(2)}
                agent={data.agent.recommendation.substance.toFixed(2)}
              />
            </div>
            {sameAsCurrent && (
              <p className="border-t border-line bg-danger-soft/50 px-5 py-3 text-small text-danger">
                The baseline stayed inside the topic the student was already watching — the exact
                failure the brief describes.
              </p>
            )}
          </div>
        </>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-line bg-surface p-10 text-center text-body text-fg-muted">
          Running both recommenders over the same history…
        </div>
      )}
    </div>
  );
}

function VerdictCell({
  label,
  shallow,
  agent,
}: {
  label: string;
  shallow: string;
  agent: string;
}) {
  return (
    <div className="bg-surface p-5">
      <p className="text-eyebrow text-fg-subtle">{label}</p>
      <p className="mt-3 text-body text-fg-muted line-through decoration-danger/40">{shallow}</p>
      <p className="mt-2 flex items-start gap-2 text-[15px] font-medium text-primary-600">
        <ArrowRight className="mt-1 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
        {agent}
      </p>
    </div>
  );
}
