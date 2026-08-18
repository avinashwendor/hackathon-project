import { Brain, Filter, Layers, ListOrdered, Radar, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    icon: Radar,
    title: "Read the behaviour",
    detail:
      "Watch time, replays, saves and — the one most systems drop — the two-second skip. Every signal decays on a four-hour half-life.",
    meta: "10 signal types",
  },
  {
    icon: Layers,
    title: "Build the taste vector",
    detail:
      "The centroid of what held attention, with what was pushed away subtracted out. Skips are not missing data; they are evidence.",
    meta: "384-d hybrid space",
  },
  {
    icon: Brain,
    title: "Climb the ladder",
    detail:
      "Surface topic → domain → motivation. The model is told the shared keyword is usually a coincidence of vocabulary, and made to find what is actually common.",
    meta: "Omega C · Sonnet 4.6",
  },
  {
    icon: ScanLine,
    title: "Search five ways",
    detail:
      "The interest, the motivation, each adjacent interest, a capability query, and the taste centroid all search independently. Best score wins.",
    meta: "MMR diversified",
  },
  {
    icon: Filter,
    title: "Refuse the hype",
    detail:
      "A deterministic lexicon blocks outcome promises, false scarcity and engagement bait before ranking — so the guarantee holds even when the model is down.",
    meta: "15 patterns",
  },
  {
    icon: ListOrdered,
    title: "Judge the shortlist",
    detail:
      "Closeness is solved by then. The reranker answers a different question: which of these is worth a student's next sixty seconds?",
    meta: "Guardrails re-checked",
  },
];

export function PipelineDiagram({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3", className)}>
      {STAGES.map((stage, i) => (
        <li key={stage.title} className="group relative flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-surface-2/50">
          <div className="flex items-center justify-between">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary-100 text-primary-600">
              <stage.icon className="size-4.5" strokeWidth={2} aria-hidden />
            </span>
            <span className="text-mono-xs text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <h3 className="text-heading-3 font-semibold text-fg">{stage.title}</h3>
          <p className="text-body text-fg-muted">{stage.detail}</p>
          <span className="mt-auto pt-2 text-mono-xs text-fg-subtle">{stage.meta}</span>
        </li>
      ))}
    </ol>
  );
}
