import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Small shared surfaces. Kept together because each is a handful of lines and
   they are always imported as a set. */

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li" | "section";
}) {
  return (
    <Tag className={cn("flex flex-col rounded-lg border border-line bg-surface p-5", className)}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border border-line bg-surface px-4 py-2.5 text-eyebrow text-primary-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

const badgeTones = {
  primary: "bg-primary-100 text-primary-600",
  signal: "bg-signal-100 text-signal-600",
  neutral: "bg-surface-2 text-fg-muted",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  outline: "border border-line-strong text-fg-muted",
  ink: "bg-white/10 text-white/85 border border-white/15",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-[11px] leading-4 font-semibold tracking-[0.06em] uppercase",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] leading-4 font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Horizontal rule that carries a label — used to break long pages into acts. */
export function RuleLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="h-px flex-1 bg-line" />
      <span className="text-eyebrow text-fg-subtle">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function Meter({
  value,
  label,
  tone = "primary",
  className,
}: {
  value: number;
  label?: string;
  tone?: "primary" | "signal" | "danger" | "success";
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const fill = {
    primary: "bg-primary-500",
    signal: "bg-signal-500",
    danger: "bg-danger",
    success: "bg-success",
  }[tone];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", fill)}
          style={{ width: `${pct}%`, transitionTimingFunction: "var(--ease-out-expo)" }}
        />
      </div>
      {label && <span className="text-mono-xs shrink-0 text-fg-subtle">{label}</span>}
    </div>
  );
}

export function Avatar({
  name,
  hue,
  size = 40,
  className,
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  const initials = name
    .replace(/^@/, "")
    .split(/[\s.]+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, hsl(${hue} 72% 58%), hsl(${(hue + 40) % 360} 68% 44%))`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
