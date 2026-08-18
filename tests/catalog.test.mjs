import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOMAINS,
  TOPIC_BY_ID,
  TOPICS,
  dominantDomain,
  matchTopics,
  topicsForCategory,
} from "@/data/ontology";
import {
  ALL_REELS,
  CATALOG_REELS,
  FEED_REELS,
  getReel,
  recommendableReels,
  scrollableReels,
} from "@/data/reels";
import { judgeReel, substanceScore } from "@/lib/agent/hype";
import { CARD_FIELDS, formatCard, summarise } from "@/lib/agent/format";
import { config } from "@/lib/config";

describe("catalog integrity", () => {
  it("has unique ids across feed and catalog", () => {
    const ids = ALL_REELS.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("keeps every topic id in the ontology", () => {
    for (const reel of ALL_REELS) {
      for (const topic of reel.topics) {
        assert.ok(TOPIC_BY_ID.has(topic), `${reel.id} references unknown topic "${topic}"`);
      }
    }
  });

  it("never recommends a feed-only meme as catalog teaching content", () => {
    const recommendable = new Set(recommendableReels().map((r) => r.id));
    for (const reel of FEED_REELS) {
      if (reel.lane === "feed") {
        assert.equal(recommendable.has(reel.id), false, `${reel.id} should stay off the recommendable pool`);
      }
    }
    assert.ok(CATALOG_REELS.length > 0);
    assert.ok(scrollableReels().length > 0);
  });

  it("looks up a known reel and misses an unknown one", () => {
    assert.ok(getReel("feed-java-meme"));
    assert.equal(getReel("missing-reel"), undefined);
  });
});

describe("ontology extras", () => {
  it("groups topics by category without orphans", () => {
    const dsa = topicsForCategory("DSA");
    assert.ok(dsa.length > 0);
    assert.ok(dsa.every((t) => t.category === "DSA"));
  });

  it("picks the domain that actually explains a mixed topic set", () => {
    const result = dominantDomain(["java", "career", "interviews"]);
    assert.ok(result.share > 0);
    assert.ok(Object.values(DOMAINS).includes(result.domain));
  });

  it("matches aliases used in student language", () => {
    const ids = matchTopics("I am grinding leetcode graphs").map((t) => t.id);
    assert.ok(ids.includes("dsa") || ids.includes("graphs"), `got ${ids}`);
  });

  it("every topic has a domain, motivation and at least one alias or label", () => {
    for (const topic of TOPICS) {
      assert.ok(topic.domain);
      assert.ok(topic.motivation);
      assert.ok(topic.label);
    }
  });
});

describe("hype + card extras", () => {
  it("scores substance downward when a catalog reel is hyped", () => {
    const hype = getReel("cat-ai-hype-listicle") ?? recommendableReels().find((r) => r.hypeMarkers.length);
    assert.ok(hype, "catalog should include a hyped reel for the trap demo");
    const verdict = judgeReel(hype);
    const score = substanceScore(hype);
    assert.ok(score <= hype.substance);
    assert.ok(score >= 0);
    if (verdict.blocked) {
      assert.ok(verdict.score >= 0.5);
    }
  });

  it("summarises a result in one line for the feed chip", () => {
    const card = {
      currentReel: "Java meme",
      interestDetected: "Software engineering as a career path",
      why: "Saved a lifestyle reel.",
      recommendedTechReel: "Rewrite one resume bullet",
      category: "Career",
      whyThisRecommendation: "Checkable skill.",
      difficulty: "Beginner",
      confidence: "Medium",
    };
    const line = summarise({ card, formatted: formatCard(card) });
    assert.match(line, /Software engineering as a career path/);
    assert.match(line, /Rewrite one resume bullet/);
    assert.equal(CARD_FIELDS.length, 8);
  });
});

describe("runtime config", () => {
  it("boots with conservative agent defaults and a local-first stack", () => {
    assert.equal(config.appName, "Upstream");
    assert.ok(config.agent.substanceFloor >= 0.4);
    assert.ok(config.agent.retrievalK >= 8);
    assert.ok(config.embeddings.localDims >= 256);
    assert.ok(["google", "local"].includes(config.embeddings.provider));
  });
});
