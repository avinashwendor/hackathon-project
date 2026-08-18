import { cn } from "@/lib/utils";

/** Soft bars fading upward, cropped by the page edge. Purely decorative. */
export function BarDecoration({ className }: { className?: string }) {
  const clusters = [
    [58, 76, 92, 70, 50],
    [62, 78, 96, 66, 84],
  ];
  return (
    <div aria-hidden className={cn("relative h-36 overflow-hidden sm:h-48", className)}>
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end px-6 blur-[6px] sm:px-10">
        {clusters.map((bars, cluster) => (
          <div key={cluster} className={cn("flex h-full flex-1 items-end gap-2", cluster === 1 && "ml-[18%]")}>
            {bars.map((height, i) => (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className="flex-1 bg-linear-to-t from-primary-400/80 via-primary-300/40 to-transparent"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
