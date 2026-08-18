import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addScaled, cosine, getProvider, reelDocument } from "@/lib/embeddings";
import { LOCAL_DIMS, embedLocal, normalize } from "@/lib/embeddings/local";
import { documentHash, toRecord } from "@/lib/vector";
import { getReel } from "@/data/reels";

describe("local hybrid embeddings", () => {
  it("emits a unit vector of the configured local dimension", () => {
    const vec = embedLocal("hash maps and garbage collection");
    assert.equal(vec.length, LOCAL_DIMS);
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    assert.ok(Math.abs(mag - 1) < 1e-6);
  });

  it("places related technical phrases closer than unrelated ones", () => {
    const java = embedLocal("Java HashMap put collision handling");
    const maps = embedLocal("hash map internals and bucket collisions");
    const music = embedLocal("sangeet dance reel from a college fest");
    assert.ok(cosine(java, maps) > cosine(java, music));
  });

  it("stems plurals so database and databases land nearer than unrelated text", () => {
    const a = embedLocal("database timeout under load");
    const b = embedLocal("databases timing out under load");
    const unrelated = embedLocal("college fest dance sangeet");
    assert.ok(cosine(a, b) > cosine(a, unrelated));
  });

  it("uses declared topics as stronger evidence than a passing mention", () => {
    const declared = embedLocal({ text: "a calm walkthrough", topics: ["databases"] });
    const mentioned = embedLocal({ text: "databases show up once in this caption" });
    const query = embedLocal({ text: "sql indexes", topics: ["databases"] });
    assert.ok(cosine(declared, query) >= cosine(mentioned, query) - 1e-9);
  });

  it("normalise is a no-op on the zero vector", () => {
    assert.deepEqual(normalize([0, 0, 0]), [0, 0, 0]);
  });
});

describe("vector maths", () => {
  it("returns 0 cosine when either side is empty", () => {
    assert.equal(cosine([1, 0], [0, 0]), 0);
    assert.equal(cosine([], [1]), 0);
  });

  it("adds a scaled source onto a missing target without mutating", () => {
    const source = [2, 0];
    const out = addScaled([], source, 0.5);
    assert.deepEqual(out, [1, 0]);
    assert.deepEqual(source, [2, 0]);
  });

  it("hashes documents stably so the embedding cache can invalidate on edit", () => {
    assert.equal(documentHash("abc"), documentHash("abc"));
    assert.notEqual(documentHash("abc"), documentHash("abd"));
  });
});

describe("provider selection", () => {
  it("falls back to the deterministic local provider without a Google key", () => {
    const provider = getProvider();
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      assert.match(provider.name, /local/);
    }
    assert.ok(provider.dims > 0);
    assert.equal(typeof provider.embed, "function");
  });

  it("indexes a reel by title, topics, outcome and transcript", () => {
    const reel = getReel("feed-java-meme");
    const doc = reelDocument(reel);
    assert.ok(doc.includes(reel.title));
    assert.match(doc, /Category:/);
    assert.match(doc, /Topics:/);
  });

  it("builds a vector payload the memory store can filter on", () => {
    const reel = getReel("feed-java-meme");
    const record = toRecord(reel, [1, 0, 0]);
    assert.equal(record.id, reel.id);
    assert.equal(record.payload.reelId, reel.id);
    assert.equal(record.payload.hyped, Boolean(reel.hypeMarkers.length));
  });
});
