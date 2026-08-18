import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISLIKE_REASON_IDS, DISLIKE_REASONS, dislikeReasonLabel } from "@/lib/social/dislike-reasons";
import { dislikeFeedbackMessage, likeFeedbackMessage, topicLabels } from "@/lib/social/feedback-messages";
import { getReel } from "@/data/reels";

describe("dislike reasons", () => {
  it("covers the seven reasons the feedback dialog ships", () => {
    assert.equal(DISLIKE_REASONS.length, 7);
    for (const reason of DISLIKE_REASONS) {
      assert.ok(reason.id);
      assert.ok(reason.label);
      assert.ok(DISLIKE_REASON_IDS.has(reason.id));
    }
  });

  it("falls back to the raw id when the reason is unknown", () => {
    assert.equal(dislikeReasonLabel("too_much_hype"), "Too much hype, not enough substance");
    assert.equal(dislikeReasonLabel("not-in-list"), "not-in-list");
  });
});

describe("feedback copy", () => {
  const reel = getReel("feed-java-meme");

  it("names ontology labels rather than raw topic ids", () => {
    const labels = topicLabels(reel);
    assert.ok(labels.length);
    assert.ok(labels.every((label) => !label.includes("-") || label.length > 3));
  });

  it("explains a like in terms of the next feed", () => {
    const msg = likeFeedbackMessage(reel);
    assert.match(msg.title, /lean this way/i);
    assert.match(msg.body, /next reels/i);
  });

  it("steers difficulty and hype with specific copy, not a generic mute", () => {
    assert.match(dislikeFeedbackMessage(reel, "too_basic").body, /intermediate and advanced/i);
    assert.match(dislikeFeedbackMessage(reel, "too_advanced").body, /beginner-friendly/i);
    assert.match(dislikeFeedbackMessage(reel, "too_much_hype").body, /substance/i);
    assert.match(dislikeFeedbackMessage(reel, "other", "too many memes").body, /too many memes/);
  });
});
