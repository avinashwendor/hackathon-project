import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendShallow, shallowFor } from "@/lib/agent/baseline";
import { getReel } from "@/data/reels";
import { CARD_FIELDS } from "@/lib/agent/format";

describe("shallow keyword baseline", () => {
  it("returns a full eight-field card so /trap can compare apples to apples", () => {
    const current = getReel("feed-java-meme");
    assert.ok(current);
    const result = recommendShallow(current);
    assert.equal(result.card.currentReel.includes(current.title), true);
    assert.equal(result.card.confidence, "High");
    for (const field of CARD_FIELDS) {
      assert.ok(result.formatted.includes(`* ${field}:`), `missing ${field}`);
    }
  });

  it("never recommends the current reel back to the student", () => {
    const current = getReel("feed-java-meme");
    const result = recommendShallow(current);
    assert.notEqual(result.recommendation.id, current.id);
  });

  it("skips already-watched ids so the trap demo is not a self-loop", () => {
    const current = getReel("feed-java-meme");
    const watchedId = recommendShallow(current).recommendation.id;
    const again = recommendShallow(current, [
      {
        id: "e1",
        sessionId: "t",
        reelId: watchedId,
        type: "view",
        at: new Date().toISOString(),
      },
    ]);
    assert.notEqual(again.recommendation.id, watchedId);
  });

  it("critiques itself: ignored history, High confidence, keyword-only method", () => {
    const current = getReel("feed-java-meme");
    const result = recommendShallow(current, []);
    assert.match(result.method, /keyword/i);
    assert.ok(result.critique.some((line) => /High confidence/i.test(line)));
    assert.ok(result.critique.some((line) => /current reel/i.test(line)));
  });

  it("returns null for an unknown reel id", () => {
    assert.equal(shallowFor("does-not-exist"), null);
  });

  it("resolves a known feed reel through shallowFor", () => {
    const result = shallowFor("feed-java-meme");
    assert.ok(result);
    assert.ok(result.recommendation.id);
  });
});
