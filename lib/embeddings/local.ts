import { TOPICS, matchTopics } from "@/data/ontology";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { config } from "@/lib/config";

/* ---------------------------------------------------------------------------
   Deterministic offline embeddings.

   Not a neural model, and it does not pretend to be. It is a hybrid feature
   vector: hashed lexical n-grams for surface similarity, plus explicit slots
   for every ontology topic, category and difficulty so that two reels about
   the same concept in different words still land near each other.

   It exists so the whole product — feed, agent, vector search — works on a
   laptop with no API keys at all. When GOOGLE_API_KEY is present, the Google
   provider replaces this entirely.
--------------------------------------------------------------------------- */

const LEXICAL_DIMS = 256;
const TOPIC_BASE = LEXICAL_DIMS;
const CATEGORY_BASE = TOPIC_BASE + TOPICS.length;
const DIFFICULTY_BASE = CATEGORY_BASE + CATEGORIES.length;
const META_BASE = DIFFICULTY_BASE + DIFFICULTIES.length;
export const LOCAL_DIMS = Math.max(config.embeddings.localDims, META_BASE + 4);

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","that","this","these","those","is","are","was","were",
  "be","been","being","to","of","in","on","for","with","as","at","by","from","it","its","you","your",
  "i","we","they","he","she","not","no","so","do","does","did","just","can","will","would","should",
  "have","has","had","what","when","where","which","who","how","why","up","out","about","into","than",
  "too","very","one","two","three","get","got","like","because","there","their","them","my","me",
]);

/**
 * A deliberately crude suffix stripper. Without it "database" and "databases"
 * hash to different buckets and a query misses the reel that answers it — the
 * exact failure a real embedding model would never have. Four rules cover the
 * plural and participle forms that actually occur in this corpus; anything
 * more aggressive starts merging words that mean different things.
 */
function stem(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("sses") || token.endsWith("shes") || token.endsWith("ches")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us")) {
    return token.slice(0, -1);
  }
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 5) return token.slice(0, -2);
  return token;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** FNV-1a — stable across processes, which matters because vectors get cached. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface LocalEmbedInput {
  text: string;
  topics?: string[];
  category?: string;
  difficulty?: string;
  substance?: number;
}

export function embedLocal(input: LocalEmbedInput | string): number[] {
  const spec: LocalEmbedInput = typeof input === "string" ? { text: input } : input;
  const vec = new Array<number>(LOCAL_DIMS).fill(0);
  const tokens = tokenize(spec.text);

  // Unigrams, with a mild sub-linear damp so a repeated word cannot dominate.
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [token, n] of counts) {
    const idx = hash(token) % LEXICAL_DIMS;
    const sign = (hash(`s:${token}`) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * (1 + Math.log(n));
  }

  // Bigrams carry the phrases that matter here ("garbage collection", "system design").
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    const idx = hash(bigram) % LEXICAL_DIMS;
    const sign = (hash(`s:${bigram}`) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * 0.7;
  }

  // Symbolic slots. Declared topics count fully; topics only detected in the
  // text count less, so a passing mention does not look like a subject.
  const declared = new Set(spec.topics ?? []);
  const detected = new Set(matchTopics(spec.text).map((t) => t.id));
  TOPICS.forEach((topic, i) => {
    const weight = declared.has(topic.id) ? 3.2 : detected.has(topic.id) ? 1.1 : 0;
    if (weight === 0) return;
    vec[TOPIC_BASE + i] += weight;
    // Neighbours the topic lifts to get a fraction, so "java" sits near "jvm-internals".
    for (const lift of topic.liftsTo) {
      const j = TOPICS.findIndex((t) => t.id === lift);
      if (j >= 0) vec[TOPIC_BASE + j] += weight * 0.35;
    }
  });

  if (spec.category) {
    const i = CATEGORIES.indexOf(spec.category as (typeof CATEGORIES)[number]);
    if (i >= 0) vec[CATEGORY_BASE + i] += 2.0;
  }
  if (spec.difficulty) {
    const i = DIFFICULTIES.indexOf(spec.difficulty as (typeof DIFFICULTIES)[number]);
    if (i >= 0) vec[DIFFICULTY_BASE + i] += 1.2;
  }
  if (typeof spec.substance === "number") {
    vec[META_BASE] += spec.substance * 1.5;
    vec[META_BASE + 1] += (1 - spec.substance) * 1.5;
  }

  return normalize(vec);
}

export function normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const mag = Math.sqrt(sum);
  if (mag === 0) return vec;
  return vec.map((v) => v / mag);
}
