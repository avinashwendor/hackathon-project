import { z } from "zod";

/** Shared body for /api/agent/recommend and /api/agent/stream. */
export const agentRequestSchema = z.object({
  scenarioId: z.string().max(80).optional(),
  currentReelId: z.string().max(80).optional(),
  events: z.array(z.record(z.string(), z.unknown())).max(120).optional(),
  allowRepeat: z.boolean().optional(),
});

/** Body for /api/agent/compare — trap demo scenario picker. */
export const compareRequestSchema = z.object({
  scenarioId: z.string().max(80).optional(),
});

/** Body for /api/quality — studio hype/topic preview. */
export const qualityRequestSchema = z.object({
  text: z.string().max(6000).optional(),
});
