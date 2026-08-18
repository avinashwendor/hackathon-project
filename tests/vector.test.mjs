import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryVectorStore } from "@/lib/vector/memory";
import { passesFilter } from "@/lib/vector/types";

const payload = (overrides = {}) => ({
  reelId: "r1",
  title: "HashMap put",
  category: "DSA",
  difficulty: "Beginner",
  topics: ["java"],
  substance: 0.8,
  lane: "catalog",
  hyped: false,
  ...overrides,
});

describe("search filters", () => {
  it("passes when no filter is given", () => {
    assert.equal(passesFilter(payload()), true);
  });

  it("restricts lane, category, substance, id and hype independently", () => {
    assert.equal(passesFilter(payload({ lane: "feed" }), { lanes: ["catalog"] }), false);
    assert.equal(passesFilter(payload({ lane: "both" }), { lanes: ["catalog"] }), true);
    assert.equal(passesFilter(payload(), { categories: ["Career"] }), false);
    assert.equal(passesFilter(payload({ substance: 0.2 }), { minSubstance: 0.45 }), false);
    assert.equal(passesFilter(payload(), { excludeIds: ["r1"] }), false);
    assert.equal(passesFilter(payload({ hyped: true }), { excludeHyped: true }), false);
    assert.equal(
      passesFilter(payload(), {
        lanes: ["catalog"],
        categories: ["DSA"],
        minSubstance: 0.4,
        excludeHyped: true,
      }),
      true,
    );
  });
});

describe("in-process vector store", () => {
  it("ranks by cosine and honours limit + filter", async () => {
    const store = new MemoryVectorStore();
    await store.init(2);
    await store.upsert([
      { id: "near", vector: [1, 0], payload: payload({ reelId: "near" }) },
      { id: "far", vector: [0, 1], payload: payload({ reelId: "far", hyped: true }) },
      { id: "mid", vector: [0.7, 0.7], payload: payload({ reelId: "mid" }) },
    ]);

    const hits = await store.search([1, 0], 2, { excludeHyped: true });
    assert.equal(hits[0].id, "near");
    assert.ok(hits[0].score > hits[1].score);
    assert.ok(!hits.some((h) => h.id === "far"));
    assert.equal(await store.count(), 3);
    assert.equal((await store.get("near"))?.id, "near");

    await store.clear();
    assert.equal(await store.count(), 0);
  });

  it("clears the space when dimensions change underneath it", async () => {
    const store = new MemoryVectorStore();
    await store.init(2);
    await store.upsert([{ id: "old", vector: [1, 0], payload: payload() }]);
    await store.init(4);
    assert.equal(await store.count(), 0);
  });
});
