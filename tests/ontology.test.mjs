import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOMAINS, TOPICS, TOPIC_BY_ID, matchTopics } from "@/data/ontology";

/* The ontology is what lets the agent climb from a shared keyword to a shared
   domain. If its links are broken the trap in the brief cannot be solved by the
   deterministic path. */

describe("interest ontology", () => {
  it("has no dangling liftsTo references", () => {
    for (const topic of TOPICS) {
      for (const lift of topic.liftsTo) {
        assert.ok(TOPIC_BY_ID.has(lift), `${topic.id} lifts to unknown topic "${lift}"`);
      }
    }
  });

  it("has unique ids", () => {
    assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length);
  });

  it("puts the trap's four surface topics in one shared domain", () => {
    // Java meme, SWE lifestyle, interview joke, laptop comparison.
    const java = TOPIC_BY_ID.get("java");
    const career = TOPIC_BY_ID.get("career");
    const interviews = TOPIC_BY_ID.get("interviews");
    assert.equal(java.motivation, career.motivation, "Java and career serve the same motivation");
    assert.equal(interviews.domain, DOMAINS.CAREER);
    assert.equal(java.domain, DOMAINS.SOFTWARE_ENGINEERING);
  });

  it("classifies developer humour as culture, not as its subject", () => {
    // A meme about Java is evidence about Java, not evidence about memes — the
    // inference layer relies on this separation to down-weight the wrapper.
    assert.equal(TOPIC_BY_ID.get("dev-humour").domain, DOMAINS.CULTURE);
  });

  it("matches plain English, including plurals", () => {
    const ids = matchTopics("my database keeps timing out under load").map((t) => t.id);
    assert.ok(ids.includes("databases"), `expected 'databases' in ${ids}`);
  });

  it("does not match on a bare substring", () => {
    // "car" must not match "career"; a naive includes() would.
    const ids = matchTopics("I drive a car to college").map((t) => t.id);
    assert.ok(!ids.includes("career"), `unexpected career match in ${ids}`);
  });
});
