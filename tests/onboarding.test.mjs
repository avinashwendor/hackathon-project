import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOTIVATIONS } from "@/data/ontology";
import {
  CATALOG_TOPIC_IDS,
  ONBOARDING_CLUSTERS,
  VIABLE_DIFFICULTIES,
  categoriesFromTopics,
  isValidLegacyOnboarding,
  isValidOnboarding,
  topicsForClusters,
} from "@/lib/onboarding/catalog-options";

const validCore = {
  topics: ["dsa", "complexity"],
  motivation: "BECOME_EMPLOYABLE",
  difficulty: VIABLE_DIFFICULTIES[0],
  goal: "Crack intern interviews",
};

describe("onboarding validation", () => {
  it("accepts a catalog cluster + topic payload the feed can index", () => {
    const error = isValidOnboarding({
      clusterIds: ["algorithms"],
      ...validCore,
    });
    assert.equal(error, null);
  });

  it("requires at least one learning area and at most four", () => {
    assert.match(isValidOnboarding({ clusterIds: [], ...validCore }), /at least one/i);
    assert.match(
      isValidOnboarding({
        clusterIds: ["career", "algorithms", "craft", "culture", "ai-ml"],
        ...validCore,
        topics: ["dsa"],
      }),
      /at most four/i,
    );
  });

  it("rejects topics that are not in the selected clusters", () => {
    const error = isValidOnboarding({
      clusterIds: ["algorithms"],
      ...validCore,
      topics: ["career"],
    });
    assert.match(error, /match your selected learning areas/i);
  });

  it("rejects unknown catalog topics and unknown motivations", () => {
    assert.match(
      isValidLegacyOnboarding({ ...validCore, topics: ["not-a-topic"] }),
      /not in the catalog/i,
    );
    assert.match(
      isValidLegacyOnboarding({ ...validCore, motivation: "NOT_REAL" }),
      /Unknown motivation/i,
    );
    assert.match(isValidLegacyOnboarding({ ...validCore, goal: "hi" }), /goal/i);
  });

  it("lists topics for a cluster and derives categories from ontology", () => {
    const topics = topicsForClusters(["algorithms"]);
    assert.ok(topics.some((t) => t.id === "dsa"));
    assert.ok(topics.every((t) => CATALOG_TOPIC_IDS.has(t.id)));
    const categories = categoriesFromTopics(["dsa", "career"]);
    assert.ok(categories.includes("DSA"));
    assert.ok(categories.includes("Career"));
  });

  it("keeps motivation keys aligned with the ontology", () => {
    for (const cluster of ONBOARDING_CLUSTERS) {
      assert.ok(cluster.topicIds.length > 0);
    }
    assert.ok("BECOME_EMPLOYABLE" in MOTIVATIONS);
  });
});
