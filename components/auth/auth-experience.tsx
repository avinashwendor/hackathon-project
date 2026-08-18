"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { FEED_REELS } from "@/data/reels";
import { Wordmark } from "@/components/brand/wordmark";
import { ReelCanvas } from "@/components/feed/reel-canvas";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type AuthMode = "signup" | "login";

interface Issue {
  field: string;
  message: string;
}

export function AuthExperience({ mode: initialMode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/feed";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phones = useMemo(() => FEED_REELS.slice(0, 2), []);
  const issueFor = (field: string) => issues.find((i) => i.field === field)?.message;

  const canSubmit =
    email.includes("@") &&
    password.length >= (mode === "signup" ? 8 : 1) &&
    (mode === "login" || name.trim().length >= 2);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setIssues([]);
    setError(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { email, password, name: name.trim() } : { email, password },
        ),
      });
      const json = (await res.json()) as { issues?: Issue[]; error?: string; account?: unknown };

      if (!res.ok) {
        if (json.issues) setIssues(json.issues);
        else setError(json.error ?? "Something went wrong. Try again.");
        return;
      }

      router.push(next.startsWith("/") ? next : "/feed");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    const nextMode = mode === "signup" ? "login" : "signup";
    setMode(nextMode);
    setIssues([]);
    setError(null);
    router.replace(nextMode === "signup" ? "/signup" : "/login");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#fafafa] text-[#262626]">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-[935px] items-center justify-center gap-16">
          <PhonePreview phones={phones} />

          <div className="w-full max-w-[350px] shrink-0">
            <div className="rounded-sm border border-[#dbdbdb] bg-white px-10 pt-12 pb-8">
              <div className="flex justify-center">
                <Wordmark size={48} className="text-[#262626]" />
              </div>

              {mode === "signup" && (
                <p className="mt-4 text-center text-[17px] leading-5 font-semibold text-[#737373]">
                  Sign up to see photos and videos from people building real skills.
                </p>
              )}

              <form onSubmit={submit} className="mt-8 space-y-1.5">
                {mode === "signup" && (
                  <Field
                    id="auth-name"
                    label="Username"
                    value={name}
                    onChange={setName}
                    autoComplete="username"
                    error={issueFor("name")}
                  />
                )}
                <Field
                  id="auth-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  error={issueFor("email")}
                />
                <Field
                  id="auth-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  error={issueFor("password")}
                  trailing={
                    password ? (
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-[13px] font-semibold text-[#262626]"
                      >
                        {showPassword ? "Hide" : "Show"}
                        <span className="sr-only"> password</span>
                      </button>
                    ) : undefined
                  }
                  hint={mode === "signup" && !issueFor("password") ? "At least 8 characters." : undefined}
                />

                {error && (
                  <p role="alert" className="pt-2 text-center text-[13px] text-[#ed4956]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || busy}
                  className={cn(
                    "mt-3 flex h-11 w-full items-center justify-center rounded-lg text-[14px] font-semibold text-white transition-colors",
                    canSubmit && !busy
                      ? "bg-[#0095f6] hover:bg-[#1877f2]"
                      : "cursor-not-allowed bg-[#4cb5f9]",
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : mode === "signup" ? (
                    "Sign up"
                  ) : (
                    "Log in"
                  )}
                </button>
              </form>

              <div className="mt-5 flex items-center gap-4">
                <span className="h-px flex-1 bg-[#dbdbdb]" />
                <span className="text-[13px] font-semibold tracking-wide text-[#737373] uppercase">or</span>
                <span className="h-px flex-1 bg-[#dbdbdb]" />
              </div>

              <p className="mt-5 flex items-start gap-2 text-[12px] leading-4 text-[#737373]">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Your watch history stays on your account. You can read or delete all of it from
                Profile.
              </p>
            </div>

            <div className="mt-2.5 rounded-sm border border-[#dbdbdb] bg-white py-5 text-center text-[14px]">
              {mode === "signup" ? "Have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-[#0095f6]"
              >
                {mode === "signup" ? "Log in" : "Sign up"}
              </button>
            </div>

            <p className="mt-6 text-center text-[13px] text-[#737373]">
              A short-form feed that actually takes you somewhere.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-4 py-8 text-center text-[12px] text-[#737373]">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/about" className="hover:underline">
            About
          </Link>
          <span>Privacy</span>
          <span>Terms</span>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} Upstream</p>
      </footer>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  error,
  trailing,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  error?: string;
  trailing?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={label}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-11 w-full rounded-[6px] border bg-[#fafafa] px-2 text-[12px] text-[#262626] outline-none placeholder:text-[#737373] focus:border-[#a8a8a8]",
            error ? "border-[#ed4956]" : "border-[#dbdbdb]",
            trailing && "pr-16",
          )}
        />
        {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </label>
      {error ? (
        <p className="mt-1 px-0.5 text-[12px] text-[#ed4956]">{error}</p>
      ) : hint ? (
        <p className="mt-1 px-0.5 text-[12px] text-[#737373]">{hint}</p>
      ) : null}
    </div>
  );
}

function PhonePreview({ phones }: { phones: typeof FEED_REELS }) {
  const front = phones[0];
  const back = phones[1];
  if (!front) return null;

  return (
    <div className="relative hidden h-[580px] w-[380px] shrink-0 lg:block" aria-hidden>
      {back && (
        <div className="absolute top-8 left-0 h-[520px] w-[250px] -rotate-6 overflow-hidden rounded-[40px] border-[8px] border-[#1a1a1a] bg-black shadow-2xl">
          <ReelCanvas reel={back} className="h-full" />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center gap-2">
              <Avatar name={back.creator.name} hue={back.creator.hue} size={28} />
              <span className="text-[12px] font-semibold text-white">{back.creator.handle}</span>
            </div>
          </div>
        </div>
      )}
      <div className="absolute top-0 right-0 h-[560px] w-[270px] overflow-hidden rounded-[42px] border-[8px] border-[#1a1a1a] bg-black shadow-2xl">
        <div className="absolute top-3 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <ReelCanvas reel={front} active className="h-full" />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/30 to-transparent p-4 pb-6">
          <div className="flex items-center gap-2">
            <Avatar name={front.creator.name} hue={front.creator.hue} size={32} />
            <span className="text-[13px] font-semibold text-white">{front.creator.handle}</span>
            <span className="rounded-md border border-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              Follow
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[12px] leading-4 text-white/90">{front.caption}</p>
        </div>
      </div>
    </div>
  );
}
