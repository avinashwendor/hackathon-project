import { cn } from "@/lib/utils";

/** Script wordmark in the Instagram logo register. */
export function Wordmark({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("font-script leading-none tracking-tight text-current select-none", className)}
      style={{ fontSize: size }}
    >
      Upstream
    </span>
  );
}
