"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, Film, Loader2, Upload, X } from "lucide-react";
import { resolveReelsMedia } from "@/data/reels";
import { useViewer } from "@/components/auth/use-viewer";
import { reelThumbnailSrc, ReelThumbnail } from "@/components/catalog/reel-thumbnail";
import { FeedShimmer } from "@/components/feed/feed-shimmer";
import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty, type Reel } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface QualityResponse {
  hype: { score: number; blocked: boolean; matched: string[] };
  topics: { id: string; label: string }[];
}

interface CompleteResponse {
  ok: boolean;
  reel: Reel;
  quality: { substance: number; blocked: boolean; note: string };
  error?: string;
}

function creatorHandle(name: string, email: string): string {
  const fromName = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (fromName.length >= 2) return `@${fromName}`;
  const local = email.split("@")[0]?.replace(/[^a-z0-9_]/gi, "") ?? "you";
  return `@${local || "you"}`;
}

export function CreateExperience() {
  const router = useRouter();
  const { viewer } = useViewer();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [caption, setCaption] = useState("");
  const [transcript, setTranscript] = useState("");
  const [outcome, setOutcome] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [category, setCategory] = useState<Category>("AI");
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    const title = caption.split("\n")[0]?.trim() ?? "";
    const text = `${title}\n${caption}\n${transcript}`;
    const timer = setTimeout(async () => {
      if (text.trim().length < 12) {
        setQuality(null);
        return;
      }
      try {
        const res = await fetch("/api/quality", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) setQuality((await res.json()) as QualityResponse);
      } catch {
        /* optional live check */
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [caption, transcript]);

  const onPickFile = (picked: File | null) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewReady(false);
    setFile(picked);
    if (picked) {
      const url = URL.createObjectURL(picked);
      previewRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a video to post.");
      return;
    }
    const title = caption.split("\n")[0]?.trim() || "New reel";
    const bodyTranscript = transcript.trim() || caption.trim();
    if (bodyTranscript.length < 20) {
      setError("Add a caption or transcript (at least 20 characters) so the reel can be indexed.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      setUploadPct(0);
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
          sizeBytes: file.size,
        }),
      });
      if (!signRes.ok) {
        throw new Error(((await signRes.json()) as { error?: string }).error ?? "Could not sign upload");
      }
      const signed = (await signRes.json()) as {
        uploadUrl: string;
        method: "PUT" | "POST";
        key: string;
        headers?: Record<string, string>;
      };

      if (signed.method === "PUT") {
        const put = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: signed.headers,
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("key", signed.key);
        const post = await fetch(signed.uploadUrl, { method: "POST", body: form });
        if (!post.ok) {
          throw new Error(((await post.json()) as { error?: string }).error ?? "Upload failed");
        }
      }
      setUploadPct(100);

      const account = viewer.account;
      const res = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          caption,
          transcript: bodyTranscript,
          outcome,
          category,
          difficulty,
          topics: quality?.topics.slice(0, 4).map((t) => t.id) ?? [],
          durationSec: 45,
          storageKey: signed.key,
          creatorHandle: account ? creatorHandle(account.name, account.email) : "@you",
          creatorName: account?.name ?? "You",
        }),
      });

      const json = (await res.json()) as CompleteResponse;
      if (!res.ok) throw new Error(json.error ?? "Could not publish reel");
      setResult({ ...json, reel: resolveReelsMedia([json.reel])[0] ?? json.reel });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  if (result?.reel) {
    const reel = result.reel;
    return (
      <div className="mx-auto w-full max-w-[470px] px-4 py-8">
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#0095f6]/15 text-[#0095f6]">
            <Check className="size-8" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold">Reel shared</h1>
          <p className="mt-2 text-[14px] text-fg-muted">{result.quality.note}</p>
        </div>

        {reelThumbnailSrc(reel) && (
          <div className="mt-6 overflow-hidden rounded-lg border border-line">
            <ReelThumbnail reel={reel} className="aspect-[4/5] w-full" />
          </div>
        )}

        <p className="mt-4 text-[14px] font-semibold">{reel.title}</p>
        <p className="text-[13px] text-fg-muted">{reel.category}</p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={`/reels?reel=${encodeURIComponent(reel.id)}`}
            className="flex h-11 items-center justify-center rounded-lg bg-[#0095f6] text-[14px] font-semibold text-white"
          >
            Watch reel
          </Link>
          <Link
            href="/feed"
            className="flex h-11 items-center justify-center rounded-lg border border-line text-[14px] font-semibold"
          >
            Back to feed
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setCaption("");
              setTranscript("");
              setOutcome("");
              onPickFile(null);
            }}
            className="text-[14px] font-semibold text-[#0095f6]"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[470px]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-[16px] font-semibold">Create new reel</h1>
        <button
          type="submit"
          form="create-reel-form"
          disabled={busy || !file || !caption.trim()}
          className="text-[14px] font-semibold text-[#0095f6] disabled:opacity-40"
        >
          {busy ? "…" : "Share"}
        </button>
      </header>

      <form id="create-reel-form" onSubmit={(e) => void submit(e)} className="px-4 pb-24 pt-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative mx-auto flex aspect-[4/5] w-full max-w-[360px] flex-col items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2"
        >
          {previewUrl ? (
            <>
              {!previewReady && <FeedShimmer className="absolute inset-0 z-10" />}
              <video
                src={previewUrl}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover",
                  previewReady ? "opacity-100" : "opacity-0",
                )}
                muted
                playsInline
                preload="auto"
                onLoadedData={() => setPreviewReady(true)}
              />
              <span className="absolute bottom-3 right-3 z-20 rounded-md bg-black/60 px-2 py-1 text-[12px] font-medium text-white">
                Change video
              </span>
            </>
          ) : (
            <>
              <span className="flex size-14 items-center justify-center rounded-full border border-line bg-bg">
                <Upload className="size-6 text-fg-muted" />
              </span>
              <p className="mt-4 text-[16px] font-semibold">Upload video</p>
              <p className="mt-1 max-w-[22ch] text-center text-[13px] text-fg-muted">
                MP4 or MOV · vertical works best · up to 512MB
              </p>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          className="sr-only"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />

        {file && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-fg-subtle">
            <Film className="size-3.5" />
            {file.name} · {(file.size / 1_048_576).toFixed(1)} MB
          </p>
        )}

        <div className="mt-6">
          <label htmlFor="caption" className="text-[13px] font-semibold text-fg-muted">
            Caption
          </label>
          <textarea
            id="caption"
            required
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption… first line becomes the title"
            className="mt-2 w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-[#0095f6]"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="outcome" className="text-[13px] font-semibold text-fg-muted">
            What will viewers learn?
          </label>
          <input
            id="outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="One concrete takeaway after watching"
            className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-[#0095f6]"
          />
        </div>

        <div className="mt-4">
          <span className="text-[13px] font-semibold text-fg-muted">Category</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  category === c
                    ? "border-[#0095f6] bg-[#0095f6]/10 text-[#0095f6]"
                    : "border-line text-fg-muted hover:border-fg-subtle",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="mt-4 text-[13px] font-semibold text-[#0095f6]"
        >
          {showDetails ? "Hide details" : "More options"}
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4 rounded-lg border border-line p-4">
            <div>
              <label htmlFor="transcript" className="text-[13px] font-semibold text-fg-muted">
                Transcript (for search)
              </label>
              <textarea
                id="transcript"
                rows={5}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="What is said in the video — defaults to caption if empty"
                className="mt-2 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-[#0095f6]"
              />
            </div>
            <div>
              <label htmlFor="difficulty" className="text-[13px] font-semibold text-fg-muted">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {quality && (
          <div
            className={cn(
              "mt-4 flex gap-2 rounded-lg p-3 text-[13px]",
              quality.hype.blocked ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-700",
            )}
          >
            {quality.hype.blocked ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0" />
            )}
            <p>
              {quality.hype.blocked
                ? `Hype detected — rewrite as a lesson (${quality.hype.matched.join(", ")})`
                : "Copy looks good — reads as a lesson, not a promise."}
            </p>
          </div>
        )}

        {uploadPct !== null && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-[#0095f6] transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-fg-subtle">Uploading… {uploadPct}%</p>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-[13px] text-red-600">
            <X className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !file || !caption.trim()}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0095f6] text-[14px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {uploadPct !== null && uploadPct < 100 ? "Uploading video…" : "Indexing reel…"}
            </>
          ) : (
            "Share reel"
          )}
        </button>
      </form>
    </div>
  );
}
