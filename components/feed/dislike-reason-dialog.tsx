"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { DISLIKE_REASONS, type DislikeReasonId } from "@/lib/social/dislike-reasons";
import { cn } from "@/lib/utils";

export function DislikeReasonDialog({
  open,
  reelTitle,
  onClose,
  onSubmit,
}: {
  open: boolean;
  reelTitle: string;
  onClose: () => void;
  onSubmit: (reason: DislikeReasonId, detail?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<DislikeReasonId | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await onSubmit(reason, reason === "other" ? detail.trim() : undefined);
      setReason("");
      setDetail("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dislike-title"
        className="w-full max-w-[420px] rounded-2xl border border-line bg-bg p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="dislike-title" className="text-[16px] font-semibold">
              What didn&apos;t work?
            </p>
            <p className="mt-1 text-[13px] text-fg-muted line-clamp-2">{reelTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-fg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {DISLIKE_REASONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setReason(opt.id)}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition",
                reason === opt.id
                  ? "border-[#0095f6] bg-[#0095f6]/5"
                  : "border-line hover:border-fg-subtle",
              )}
            >
              <span className="text-[14px] font-medium">{opt.label}</span>
              <span className="mt-0.5 block text-[12px] text-fg-muted">{opt.description}</span>
            </button>
          ))}
        </div>

        {reason === "other" && (
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Briefly say what you'd rather see instead…"
            rows={2}
            className="mt-3 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-[#0095f6]"
          />
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-line py-2.5 text-[14px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason || busy || (reason === "other" && detail.trim().length < 4)}
            onClick={() => void submit()}
            className="flex-1 rounded-lg bg-[#0095f6] py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Update my feed"}
          </button>
        </div>
      </div>
    </div>
  );
}
