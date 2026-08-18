"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  MOTIVATION_OPTIONS,
  ONBOARDING_CLUSTERS,
  VIABLE_DIFFICULTIES,
  topicsForClusters,
} from "@/lib/onboarding/catalog-options";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [clusters, setClusters] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [motivation, setMotivation] = useState("BECOME_EMPLOYABLE");
  const [difficulty, setDifficulty] = useState<(typeof VIABLE_DIFFICULTIES)[number]>("Beginner");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicOptions = useMemo(() => topicsForClusters(clusters), [clusters]);

  const toggle = (list: string[], value: string, max: number) => {
    if (list.includes(value)) return list.filter((v) => v !== value);
    if (list.length >= max) return list;
    return [...list, value];
  };

  const onClustersChange = (next: string[]) => {
    setClusters(next);
    const allowed = new Set(topicsForClusters(next).map((t) => t.id));
    setTopics((prev) => prev.filter((id) => allowed.has(id)));
  };

  const canNext =
    step === 0
      ? clusters.length >= 1
      : step === 1
        ? topics.length >= 1
        : step === 2
          ? goal.trim().length >= 4
          : true;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusters, topics, motivation, difficulty, goal: goal.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save preferences.");
        return;
      }
      router.push("/feed");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-10">
      <div className="text-center">
        <Wordmark className="mx-auto h-10" />
        <p className="mt-4 text-[15px] text-fg-muted">
          Pick from areas we actually have reels for — your feed is built from this.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-10 rounded-full",
                i <= step ? "bg-[#0095f6]" : "bg-line",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-10">
        {step === 0 && (
          <>
            <h1 className="text-[20px] font-semibold">What do you want to learn?</h1>
            <p className="mt-1 text-[14px] text-fg-muted">
              Choose up to 4 areas — sized by how many reels we have in each.
            </p>
            <div className="mt-6 space-y-2">
              {ONBOARDING_CLUSTERS.map((cluster) => (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => onClustersChange(toggle(clusters, cluster.id, 4))}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left transition",
                    clusters.includes(cluster.id)
                      ? "border-[#0095f6] bg-[#0095f6]/5"
                      : "border-line hover:border-fg-subtle",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">{cluster.label}</span>
                    <span className="shrink-0 text-[12px] text-fg-subtle">
                      {cluster.reelCount} reels
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-muted">{cluster.description}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-[20px] font-semibold">Narrow it down</h1>
            <p className="mt-1 text-[14px] text-fg-muted">
              Topics with real video in our catalog — up to 8.
            </p>
            <div className="mt-6 flex max-h-[340px] flex-wrap gap-2 overflow-y-auto">
              {topicOptions.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setTopics((t) => toggle(t, topic.id, 8))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                    topics.includes(topic.id)
                      ? "border-[#0095f6] bg-[#0095f6]/10 text-[#0095f6]"
                      : "border-line text-fg-muted hover:border-fg-subtle",
                  )}
                >
                  {topic.label}
                  <span className="ml-1 text-[11px] opacity-60">({topic.reelCount})</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-[20px] font-semibold">What&apos;s your goal?</h1>
            <p className="mt-1 text-[14px] text-fg-muted">
              Used for semantic search — be specific for better matches.
            </p>

            <label className="mt-6 block text-[13px] font-semibold text-fg-muted">Motivation</label>
            <div className="mt-2 space-y-2">
              {MOTIVATION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMotivation(opt.key)}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left text-[14px] transition",
                    motivation === opt.key
                      ? "border-[#0095f6] bg-[#0095f6]/5"
                      : "border-line hover:border-fg-subtle",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="mt-6 block text-[13px] font-semibold text-fg-muted">Level</label>
            <div className="mt-2 flex gap-2">
              {VIABLE_DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-[14px] font-medium",
                    difficulty === d
                      ? "border-[#0095f6] bg-[#0095f6]/10 text-[#0095f6]"
                      : "border-line text-fg-muted",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>

            <label className="mt-6 block text-[13px] font-semibold text-fg-muted">
              In your own words
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I want to pass DSA interviews and understand time complexity"
              className="mt-2 w-full resize-none rounded-lg border border-line bg-bg px-3 py-3 text-[14px] outline-none focus:border-[#0095f6]"
              rows={3}
            />
          </>
        )}

        {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-lg border border-line py-2.5 text-[14px] font-semibold"
            >
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-lg bg-[#0095f6] py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext || busy}
              onClick={() => void submit()}
              className="flex-1 rounded-lg bg-[#0095f6] py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Build my feed"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
