import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The framed page column: a centred canvas with hairline edges and faint
 * diagonal hatching filling the gutters beyond them. It is what makes the
 * product read as a considered document rather than a dashboard.
 */
export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("hatch flex flex-1 justify-center bg-bg", className)}>
      <div className="flex w-full max-w-[1240px] flex-col bg-bg min-[1300px]:border-x min-[1300px]:border-line">
        {children}
      </div>
    </div>
  );
}

/** Standard horizontal rhythm for page sections inside the frame. */
export function Section({
  children,
  className,
  bordered = false,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
  as?: "section" | "div" | "main";
}) {
  return (
    <Tag
      className={cn(
        "px-5 py-12 sm:px-10 lg:px-16 lg:py-16",
        bordered && "border-t border-line",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
