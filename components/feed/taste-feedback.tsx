"use client";

import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TasteFeedbackMessage {
  id: string;
  tone: "like" | "dislike";
  title: string;
  body: string;
}

export function TasteFeedbackToast({
  message,
  onDismiss,
}: {
  message: TasteFeedbackMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 z-[90] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md sm:bottom-8",
        message.tone === "like"
          ? "border-[#0095f6]/30 bg-[#0095f6]/10"
          : "border-line bg-surface/95",
      )}
    >
      <div className="flex items-start gap-3">
        <Sparkles
          className={cn("mt-0.5 size-4 shrink-0", message.tone === "like" ? "text-[#0095f6]" : "text-fg-muted")}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{message.title}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-fg-muted">{message.body}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-1 text-fg-subtle">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
