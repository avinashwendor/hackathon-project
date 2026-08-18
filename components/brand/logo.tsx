import { cn } from "@/lib/utils";

/* The mark is a play triangle rotated to point up: the same gesture that starts
   a reel, aimed somewhere. The notch keeps it from reading as a plain arrow. */

export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M16 2.5 30.4 27.5a1.6 1.6 0 0 1-1.4 2.4H3a1.6 1.6 0 0 1-1.4-2.4L16 2.5Z"
        fill="currentColor"
      />
      <path d="M16 13.2 22.4 24.6H9.6L16 13.2Z" className="fill-[var(--color-bg)]" />
    </svg>
  );
}

export function Logo({
  className,
  size = 26,
  showWordmark = true,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} className="text-primary-500" />
      {showWordmark && (
        <span
          className="font-display font-bold tracking-[-0.02em] text-fg"
          style={{ fontSize: size * 0.86 }}
        >
          Upstream
        </span>
      )}
    </span>
  );
}
