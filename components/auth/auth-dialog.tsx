"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Auth dialog.

   Hand-rolled rather than pulled from a library, because the accessibility
   requirements here are specific and short: a labelled modal, focus moved in on
   open and restored on close, focus trapped while open, Escape to dismiss, and
   the background made inert to screen readers.

   The copy matters as much as the mechanics. The prompt appears because the
   agent has learned something worth keeping, so it says that, rather than
   demanding a signup to continue.
--------------------------------------------------------------------------- */

export type AuthMode = "signup" | "login";

interface Issue {
  field: string;
  message: string;
}

export function AuthDialog({
  open,
  mode: initialMode,
  reason,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  mode?: AuthMode;
  /** Why the dialog appeared — shown when the agent triggered it. */
  reason?: string | null;
  onClose: () => void;
  onAuthenticated: (account: { id: string; email: string; name: string }, migrated: number) => void;
}) {
  /**
   * The caller decides which mode the dialog opens in; the user can switch once
   * it is open. Storing an override rather than mirroring the prop into state
   * keeps the two in sync without an effect.
   */
  const [modeOverride, setModeOverride] = useState<AuthMode | null>(null);
  const mode = modeOverride ?? initialMode ?? "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Focus management + trap + Escape.
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => firstFieldRef.current?.focus(), 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const issueFor = (field: string) => issues.find((i) => i.field === field)?.message;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setIssues([]);
    setError(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { email, password, name: name || undefined } : { email, password },
        ),
      });
      const json = (await res.json()) as {
        account?: { id: string; email: string; name: string };
        migratedEvents?: number;
        issues?: Issue[];
        error?: string;
      };

      if (!res.ok) {
        if (json.issues) setIssues(json.issues);
        else setError(json.error ?? "Something went wrong. Try again.");
        return;
      }
      if (json.account) onAuthenticated(json.account, json.migratedEvents ?? 0);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "focus-ring w-full rounded-md border bg-surface px-4 py-3 text-[15px] text-fg placeholder:text-fg-subtle";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-950/70 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={reason ? descId : undefined}
        className="animate-rise w-full max-w-md overflow-hidden rounded-xl border border-line bg-bg shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            {reason && (
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-[12px] font-medium text-primary-600">
                <Sparkles className="size-3.5" aria-hidden />
                From the agent
              </p>
            )}
            <h2 id={titleId} className="font-display text-[24px] leading-tight font-bold text-fg">
              {mode === "signup" ? "Keep what it has learned" : "Welcome back"}
            </h2>
            {reason && (
              <p id={descId} className="mt-2 text-body text-fg-muted">
                {reason}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -mt-1 rounded-sm p-1.5 text-fg-subtle transition-colors hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-6">
          {mode === "signup" && (
            <div>
              <label htmlFor="auth-name" className="text-eyebrow text-fg-subtle">
                Name <span className="normal-case tracking-normal opacity-70">(optional)</span>
              </label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={cn(field, "mt-2 border-line-strong")}
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="text-eyebrow text-fg-subtle">
              Email
            </label>
            <input
              ref={firstFieldRef}
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(issueFor("email"))}
              aria-describedby={issueFor("email") ? "auth-email-error" : undefined}
              className={cn(field, "mt-2", issueFor("email") ? "border-danger" : "border-line-strong")}
            />
            {issueFor("email") && (
              <p id="auth-email-error" className="mt-1.5 text-small text-danger">
                {issueFor("email")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="auth-password" className="text-eyebrow text-fg-subtle">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              aria-invalid={Boolean(issueFor("password"))}
              aria-describedby={issueFor("password") ? "auth-password-error" : "auth-password-hint"}
              className={cn(field, "mt-2", issueFor("password") ? "border-danger" : "border-line-strong")}
            />
            {issueFor("password") ? (
              <p id="auth-password-error" className="mt-1.5 text-small text-danger">
                {issueFor("password")}
              </p>
            ) : (
              mode === "signup" && (
                <p id="auth-password-hint" className="mt-1.5 text-small text-fg-subtle">
                  At least 8 characters.
                </p>
              )
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-body text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {mode === "signup" ? "Creating your account…" : "Signing in…"}
              </>
            ) : mode === "signup" ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </Button>

          <p className="flex items-start gap-2 text-small text-fg-subtle">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Your watch history moves with you and stays yours — the profile page has a button that
            deletes all of it.
          </p>

          <p className="border-t border-line pt-4 text-center text-body text-fg-muted">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              onClick={() => {
                setModeOverride(mode === "signup" ? "login" : "signup");
                setIssues([]);
                setError(null);
              }}
              className="focus-ring rounded-xs font-medium text-primary-500 hover:text-primary-600"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
