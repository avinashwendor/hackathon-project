import { ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

/* The phrases the guardrail actually fires on, shown struck through. Naming the
   mechanism is more convincing than describing it. */

const BLOCKED = [
  { phrase: "will get you a job in 2026", kind: "outcome promise" },
  { phrase: "nobody is talking about this", kind: "false scarcity" },
  { phrase: "cracked a ₹50 LPA package in 3 months", kind: "salary flex" },
  { phrase: "comment HIRED and I'll DM you", kind: "engagement bait" },
  { phrase: "99% of students are sleeping on these", kind: "manufactured stat" },
  { phrase: "the shortcut colleges are hiding", kind: "conspiracy framing" },
  { phrase: "master Java in 10 minutes", kind: "impossible timeline" },
  { phrase: "save this before it's deleted", kind: "engagement bait" },
];

export function HypeWall({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-6 sm:p-8", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-danger-soft text-danger">
          <ShieldX className="size-4.5" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h3 className="text-heading-3 font-semibold text-fg">Refused before ranking</h3>
          <p className="text-small text-fg-muted">
            Deterministic. Runs with or without the model, and against popularity by design.
          </p>
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap gap-2">
        {BLOCKED.map((item) => (
          <li
            key={item.phrase}
            className="group inline-flex items-baseline gap-2 rounded-full border border-danger/20 bg-danger-soft/60 px-3.5 py-2"
          >
            <span className="text-[13px] leading-4 text-danger line-through decoration-danger/50">
              “{item.phrase}”
            </span>
            <span className="text-mono-xs text-danger/70">{item.kind}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 border-t border-line pt-5 text-body text-fg-muted">
        The reel with 11.2M plays in this catalog is the one the filter blocks hardest. That is the
        point — an engagement-ranked feed would put it first, every time.
      </p>
    </div>
  );
}
