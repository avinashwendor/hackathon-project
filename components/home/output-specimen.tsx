import { cn } from "@/lib/utils";

/* The eight-field block the brief specifies, set as a specimen sheet. It is the
   product's signature artefact, so it is typeset rather than dumped. */

const FIELDS: { label: string; value: string; accent?: boolean; long?: boolean }[] = [
  { label: "Current reel", value: "Java asking if you're SURE you want a String (@stacktrace.jpg)" },
  { label: "Interest detected", value: "Becoming a hireable software engineer", accent: true },
  {
    label: "Why",
    value:
      "Saved a day-in-the-life reel, re-watched an interview joke 1.8×, saved a laptop comparison. The four reels share no vocabulary — they share a vantage point.",
    long: true,
  },
  { label: "Recommended tech reel", value: "Rewrite one resume bullet with me", accent: true },
  { label: "Category", value: "Career" },
  {
    label: "Why this recommendation",
    value:
      "They are assembling a picture of what getting hired asks of them. This teaches one checkable skill instead of promising an outcome.",
    long: true,
  },
  { label: "Difficulty", value: "Beginner" },
  { label: "Confidence", value: "High" },
];

export function OutputSpecimen({ className }: { className?: string }) {
  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-lg border border-line bg-surface shadow-lg",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/60 px-5 py-3">
        <span className="text-eyebrow text-fg-subtle">Agent output</span>
        <span className="text-mono-xs text-fg-subtle">8 fields · required format</span>
      </div>

      <dl className="divide-y divide-line">
        {FIELDS.map((field) => (
          <div
            key={field.label}
            className={cn(
              "grid gap-1 px-5 py-3.5 sm:gap-4 sm:px-6",
              field.long ? "sm:grid-cols-[170px_1fr]" : "sm:grid-cols-[170px_1fr] sm:items-baseline",
            )}
          >
            <dt className="text-mono-xs uppercase text-fg-subtle">{field.label}</dt>
            <dd
              className={cn(
                "text-[14px] leading-6",
                field.accent ? "font-medium text-primary-600" : "text-fg",
              )}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="h-1 bg-linear-to-r from-primary-500 via-primary-400 to-signal-500" aria-hidden />
    </figure>
  );
}
