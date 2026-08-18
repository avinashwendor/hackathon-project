"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentResult, AgentStage, InteractionEvent } from "@/lib/types";

export interface RunRequest {
  scenarioId?: string;
  currentReelId?: string;
  events?: InteractionEvent[];
  allowRepeat?: boolean;
}

export type RunStatus = "idle" | "running" | "done" | "error";

/**
 * Drives a streamed agent run. Stages arrive as they happen so the trace fills
 * in live; the final result replaces them with the authoritative copy.
 */
export function useAgentRun() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [stages, setStages] = useState<AgentStage[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (request: RunRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("running");
    setStages([]);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Agent request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;

          const event = JSON.parse(payload) as { type: string; payload: unknown };
          if (event.type === "stage") {
            const stage = event.payload as AgentStage;
            setStages((prev) => {
              const next = [...prev];
              const i = next.findIndex((s) => s.key === stage.key);
              if (i >= 0) next[i] = stage;
              else next.push(stage);
              return next;
            });
          } else if (event.type === "result") {
            const agentResult = event.payload as AgentResult;
            setResult(agentResult);
            setStages(agentResult.stages);
            setStatus("done");
          } else if (event.type === "error") {
            setError((event.payload as { message: string }).message);
            setStatus("error");
          }
        }
      }

      setStatus((s) => (s === "running" ? "done" : s));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setStages([]);
    setResult(null);
    setError(null);
  }, []);

  return { status, stages, result, error, run, reset };
}
