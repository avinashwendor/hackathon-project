import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
   Rate limiting.

   In-process fixed windows keyed by route + client IP. On a single Railway
   instance this is exactly right; behind more than one it becomes per-instance,
   which is documented rather than pretended away — the interface is narrow
   enough to swap for Redis without touching a route.

   The point is not to stop a determined attacker. It is to make credential
   stuffing and agent-endpoint abuse cost something, since every agent call
   spends real model tokens.
--------------------------------------------------------------------------- */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
let lastSweep = Date.now();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

function sweep(now: number): void {
  // Amortised cleanup: without it the map grows for the life of the process.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt < now) windows.delete(key);
  }
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

/**
 * Returns a 429 response when the caller is over budget, or null to continue.
 * Callers `if (limited) return limited;` which keeps the check impossible to
 * forget halfway down a handler.
 */
export async function rateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  const now = Date.now();
  sweep(now);

  const id = `${options.key}:${clientKey(request)}`;
  const existing = windows.get(id);

  if (!existing || existing.resetAt < now) {
    windows.set(id, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  existing.count++;
  if (existing.count <= options.limit) return null;

  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(options.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
