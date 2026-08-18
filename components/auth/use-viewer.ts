"use client";

import { useCallback, useEffect, useState } from "react";

export interface ViewerState {
  signedIn: boolean;
  account: { id: string; email: string; name: string } | null;
  eventCount: number;
  watchedCount: number;
  follows: string[];
  dislikes: number;
}

const EMPTY: ViewerState = {
  signedIn: false,
  account: null,
  eventCount: 0,
  watchedCount: 0,
  follows: [],
  dislikes: 0,
};

/** Who the viewer is. Shared by the header, the feed and the profile page. */
export function useViewer() {
  const [viewer, setViewer] = useState<ViewerState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) setViewer((await res.json()) as ViewerState);
    } catch {
      // Offline: the anonymous state is a correct fallback.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) setViewer((await res.json()) as ViewerState);
      } catch {
        /* anonymous */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { viewer, loading, refresh, setViewer };
}
