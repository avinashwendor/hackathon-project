import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAffinities, primarySignal } from "@/lib/agent/signals";

const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const at = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();

const view = (reelId, completion, minutesAgo = 0) => ({
  id: `${reelId}-v`,
  sessionId: "t",
  reelId,
  type: "view",
  at: at(minutesAgo),
  completion,
  durationMs: 30_000,
  watchedMs: 30_000 * completion,
});

/* The signal layer is where the agent's judgement actually comes from, so these
   assert the properties the design depends on rather than exact numbers. */

describe("implicit feedback", () => {
  it("scores a completed watch positively and an early skip negatively", () => {
    const [completed] = computeAffinities([view("a", 0.95)], now);
    const [skipped] = computeAffinities([view("b", 0.08)], now);
    assert.ok(completed.score > 0, "a completed watch is a positive signal");
    assert.ok(skipped.score < 0, "an early skip is a negative signal, not a neutral one");
  });

  it("ranks a save above a like", () => {
    const liked = computeAffinities(
      [view("a", 0.6), { id: "l", sessionId: "t", reelId: "a", type: "like", at: at(0) }],
      now,
    )[0];
    const saved = computeAffinities(
      [view("b", 0.6), { id: "s", sessionId: "t", reelId: "b", type: "save", at: at(0) }],
      now,
    )[0];
    assert.ok(saved.score > liked.score, "a save is a stronger intent signal than a like");
  });

  it("treats a re-watch as stronger than a single completion", () => {
    const once = computeAffinities([view("a", 1.0)], now)[0];
    const twice = computeAffinities([view("b", 2.2)], now)[0];
    assert.ok(twice.score > once.score);
  });

  it("decays older signals", () => {
    const fresh = computeAffinities([view("a", 1.0, 0)], now)[0];
    const stale = computeAffinities([view("b", 1.0, 60 * 24)], now)[0];
    assert.ok(fresh.score > stale.score, "a day-old signal must not outweigh a fresh one");
  });

  it("clamps into [-1, 1] however much evidence piles up", () => {
    const events = [
      view("a", 3),
      { id: "1", sessionId: "t", reelId: "a", type: "like", at: at(0) },
      { id: "2", sessionId: "t", reelId: "a", type: "save", at: at(0) },
      { id: "3", sessionId: "t", reelId: "a", type: "share", at: at(0) },
      { id: "4", sessionId: "t", reelId: "a", type: "replay", at: at(0), replays: 9 },
    ];
    const [affinity] = computeAffinities(events, now);
    assert.ok(affinity.score <= 1 && affinity.score >= -1);
  });

  it("lets an explicit dislike overpower a full watch", () => {
    const [affinity] = computeAffinities(
      [view("a", 1.0), { id: "n", sessionId: "t", reelId: "a", type: "not_interested", at: at(0) }],
      now,
    );
    assert.ok(affinity.score < 0, "saying 'not interested' must win over watch time");
  });

  it("explains itself", () => {
    const [affinity] = computeAffinities(
      [view("a", 1.0), { id: "s", sessionId: "t", reelId: "a", type: "save", at: at(0) }],
      now,
    );
    assert.ok(affinity.basis.length > 0);
    assert.match(primarySignal(affinity), /saved|watched/);
  });

  it("sorts strongest first", () => {
    const affinities = computeAffinities([view("weak", 0.3), view("strong", 1.0)], now);
    assert.equal(affinities[0].reelId, "strong");
  });
});
