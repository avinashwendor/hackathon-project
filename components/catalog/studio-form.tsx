"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Film, Loader2, Upload } from "lucide-react";
import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty, type Reel } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge, Card, Chip, Meter } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface QualityResponse {
  hype: { score: number; blocked: boolean; kinds: string[]; matched: string[] };
  topics: { id: string; label: string; category: string }[];
}

interface CompleteResponse {
  ok: boolean;
  reel: Reel;
  storage: string;
  quality: { substance: number; hypeScore: number; blocked: boolean; note: string };
  error?: string;
}

const FIELD =
  "focus-ring w-full rounded-md border border-line-strong bg-surface px-4 py-3 text-[15px] text-fg placeholder:text-fg-subtle focus:border-primary-400";

export function StudioForm() {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [transcript, setTranscript] = useState("");
  const [outcome, setOutcome] = useState("");
  const [category, setCategory] = useState<Category>("AI");
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live copy check — the hype filter is the house rule, so contributors get to
  // see it fire while they are still writing rather than after they submit.
  useEffect(() => {
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
        /* live check is a nicety, not a requirement */
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [title, caption, transcript]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      let storageKey: string | undefined;

      if (file) {
        setUploadPct(0);
        const signRes = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
        });
        if (!signRes.ok) throw new Error((await signRes.json()).error ?? "Could not sign the upload");
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
          if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
        } else {
          const form = new FormData();
          form.append("file", file);
          form.append("key", signed.key);
          const post = await fetch(signed.uploadUrl, { method: "POST", body: form });
          if (!post.ok) throw new Error((await post.json()).error ?? "Local upload failed");
        }

        storageKey = signed.key;
        setUploadPct(100);
      }

      const res = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          caption,
          transcript,
          outcome,
          category,
          difficulty,
          topics: quality?.topics.slice(0, 4).map((t) => t.id) ?? [],
          durationSec: 45,
          storageKey,
        }),
      });

      const json = (await res.json()) as CompleteResponse;
      if (!res.ok) throw new Error(json.error ?? "Ingest failed");
      setResult(json);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="title" className="text-eyebrow text-fg-subtle">
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What actually happens inside HashMap.put()"
            className={cn(FIELD, "mt-2.5")}
          />
        </div>

        <div>
          <label htmlFor="caption" className="text-eyebrow text-fg-subtle">
            Caption
          </label>
          <input
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="hash → spread → bucket → tree at 8 entries"
            className={cn(FIELD, "mt-2.5")}
          />
        </div>

        <div>
          <label htmlFor="transcript" className="text-eyebrow text-fg-subtle">
            Transcript
          </label>
          <p className="mt-1.5 text-small text-fg-muted">
            This is what the embedding actually reads. Write what is said, not what it is about.
          </p>
          <textarea
            id="transcript"
            required
            rows={7}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your key's hashCode is spread by XOR-ing the high bits down, because…"
            className={cn(FIELD, "mt-2.5 resize-y leading-6")}
          />
        </div>

        <div>
          <label htmlFor="outcome" className="text-eyebrow text-fg-subtle">
            What can they do afterwards?
          </label>
          <p className="mt-1.5 text-small text-fg-muted">
            A checkable capability. Reels without one sit below the substance floor and are never
            recommended.
          </p>
          <input
            id="outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Explain HashMap lookup cost and why the equals/hashCode contract matters."
            className={cn(FIELD, "mt-2.5")}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="text-eyebrow text-fg-subtle">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={cn(FIELD, "mt-2.5 appearance-none")}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="difficulty" className="text-eyebrow text-fg-subtle">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className={cn(FIELD, "mt-2.5 appearance-none")}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* File */}
        <div>
          <span className="text-eyebrow text-fg-subtle">Video (optional)</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="focus-ring mt-2.5 flex w-full items-center gap-4 rounded-md border border-dashed border-line-strong bg-surface px-5 py-6 text-left transition-colors hover:border-primary-300"
          >
            <span className="flex size-11 items-center justify-center rounded-md bg-primary-100 text-primary-600">
              {file ? <Film className="size-5" /> : <Upload className="size-5" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-fg">
                {file ? file.name : "Choose a vertical video"}
              </span>
              <span className="block text-small text-fg-muted">
                {file
                  ? `${(file.size / 1_048_576).toFixed(1)} MB — uploads straight to storage, never through this server`
                  : "MP4 or MOV, up to 512MB. Without one, the reel renders its generated poster."}
              </span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {uploadPct !== null && <Meter className="mt-3" value={uploadPct / 100} label={`${uploadPct}%`} />}
        </div>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} size="lg">
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Embedding and indexing…
            </>
          ) : (
            "Ingest into the catalog"
          )}
        </Button>
      </form>

      {/* Live verdict */}
      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <Card className="gap-4">
          <h2 className="text-eyebrow text-fg-subtle">Live copy check</h2>

          {!quality ? (
            <p className="text-body text-fg-muted">
              Start writing. The hype filter runs on every keystroke, the same lexicon retrieval
              uses.
            </p>
          ) : (
            <>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-body text-fg-muted">hype score</span>
                  <span
                    className={cn(
                      "text-mono-sm",
                      quality.hype.blocked ? "text-danger" : "text-success",
                    )}
                  >
                    {quality.hype.score.toFixed(2)}
                  </span>
                </div>
                <Meter
                  className="mt-2"
                  value={quality.hype.score}
                  tone={quality.hype.blocked ? "danger" : "success"}
                />
              </div>

              {quality.hype.blocked ? (
                <div className="flex gap-2.5 rounded-md bg-danger-soft p-3.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  <div>
                    <p className="text-[14px] font-medium text-danger">This would be refused</p>
                    <p className="mt-1 text-small text-fg-muted">
                      Rewrite the promise as a lesson. Blocked phrases:{" "}
                      {quality.hype.matched.map((m) => `“${m}”`).join(", ")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5 rounded-md bg-success-soft p-3.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} aria-hidden />
                  <p className="text-[14px] text-fg">Reads as a lesson, not a promise.</p>
                </div>
              )}

              {quality.topics.length > 0 && (
                <div>
                  <p className="text-mono-xs text-fg-subtle">topics detected</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quality.topics.map((topic) => (
                      <Chip key={topic.id}>{topic.label}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {result && (
          <Card className="gap-3 border-primary-200 bg-primary-100/40">
            <div className="flex items-center gap-2">
              <Badge tone="primary">Indexed</Badge>
              <span className="text-mono-xs text-fg-subtle">{result.storage}</span>
            </div>
            <p className="text-[15px] font-medium text-fg">{result.reel.title}</p>
            <p className="text-body text-fg-muted">{result.quality.note}</p>
            <dl className="mt-1 space-y-1 text-mono-xs text-fg-muted">
              <div className="flex justify-between">
                <dt>substance</dt>
                <dd className="text-fg">{result.quality.substance.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>id</dt>
                <dd className="text-fg">{result.reel.id}</dd>
              </div>
            </dl>
            {result.reel.media.storageKey && (
              <div className="mt-2 border-t border-primary-200 pt-3">
                <p className="text-mono-xs text-fg-subtle">make it adaptive:</p>
                <code className="mt-1.5 block overflow-x-auto rounded-sm bg-fg/5 p-2.5 text-mono-xs text-fg">
                  npm run transcode -- --key {result.reel.media.storageKey}
                </code>
              </div>
            )}
          </Card>
        )}
      </aside>
    </div>
  );
}
