/**
 * Regenerate onboarding-options.json after catalog.json changes.
 * Run: node scripts/generate-onboarding-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOTIVATIONS, TOPICS } from "../data/ontology.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const MIN_TOPIC_REELS = 2;
const MIN_CATEGORY_REELS = 3;

const catalog = JSON.parse(
  readFileSync(path.join(root, "data/generated/catalog.json"), "utf8"),
);

const topicCount = new Map();
const categoryCount = new Map();
const difficultyCount = new Map();

for (const reel of catalog.reels) {
  categoryCount.set(reel.category, (categoryCount.get(reel.category) ?? 0) + 1);
  difficultyCount.set(reel.difficulty, (difficultyCount.get(reel.difficulty) ?? 0) + 1);
  for (const t of reel.topics ?? []) {
    topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  }
}

const CATEGORY_LABELS = {
  Other: "Dev tools & culture",
  HLD: "System design",
  AI: "AI & ML",
  DSA: "Algorithms",
  Java: "Java",
  Cybersecurity: "Security",
  Cloud: "Cloud & DevOps",
  Hardware: "Hardware",
  Career: "Career",
};

const catalogTopics = TOPICS.filter((t) => (topicCount.get(t.id) ?? 0) >= MIN_TOPIC_REELS)
  .map((t) => ({
    id: t.id,
    label: t.label,
    category: t.category,
    reelCount: topicCount.get(t.id) ?? 0,
    domain: t.domain,
  }))
  .sort((a, b) => b.reelCount - a.reelCount);

const catalogTopicIds = new Set(catalogTopics.map((t) => t.id));

const CLUSTER_DEFS = [
  {
    id: "algorithms",
    label: "Algorithms & DSA",
    description: "Data structures, complexity, graphs, hashing",
    topicIds: ["dsa", "complexity", "graphs", "hashing", "dynamic-programming"],
  },
  {
    id: "career",
    label: "Career & Interviews",
    description: "Placements, code review, portfolio, communication",
    topicIds: [
      "career",
      "interviews",
      "code-review",
      "portfolio",
      "build-in-public",
      "communication",
      "engineering-culture",
    ],
  },
  {
    id: "ai-ml",
    label: "AI & Machine Learning",
    description: "LLMs, ML engineering, transformers",
    topicIds: ["ai", "ml-engineering", "transformers"],
  },
  {
    id: "craft",
    label: "Software Craft",
    description: "Debugging, testing, Git, API design",
    topicIds: ["debugging", "testing", "git", "api-design"],
  },
  {
    id: "systems",
    label: "Systems & Infrastructure",
    description: "System design, distributed systems, databases, performance",
    topicIds: [
      "system-design",
      "distributed-systems",
      "databases",
      "caching",
      "performance",
      "queues",
      "indexing",
    ],
  },
  {
    id: "security",
    label: "Security",
    description: "App security, web security, auth, cryptography",
    topicIds: ["security", "web-security", "auth", "cryptography"],
  },
  {
    id: "cloud",
    label: "Cloud & DevOps",
    description: "Containers, CI/CD, cloud platforms",
    topicIds: ["cloud", "containers", "ci-cd"],
  },
  {
    id: "culture",
    label: "Tech News & Dev Culture",
    description: "Industry news, memes, builder culture",
    topicIds: ["tech-news", "dev-humour", "entertainment"],
  },
  {
    id: "hardware",
    label: "Hardware & Low-Level",
    description: "CPU, memory, hardware fundamentals",
    topicIds: ["hardware", "cpu-architecture", "memory-model"],
  },
  {
    id: "java",
    label: "Java (limited catalog)",
    description: "JVM, collections, Spring — few reels today",
    topicIds: ["java", "collections", "jvm-internals", "spring-boot"],
  },
];

const clusters = CLUSTER_DEFS.map((cluster) => {
  const topicIds = cluster.topicIds.filter((id) => catalogTopicIds.has(id));
  const reelCount = topicIds.reduce((sum, id) => sum + (topicCount.get(id) ?? 0), 0);
  return { ...cluster, topicIds, reelCount };
})
  .filter((c) => c.reelCount >= MIN_CATEGORY_REELS)
  .sort((a, b) => b.reelCount - a.reelCount);

const viableCategories = [...categoryCount.entries()]
  .filter(([, n]) => n >= MIN_CATEGORY_REELS)
  .map(([category, reelCount]) => ({
    category,
    reelCount,
    label: CATEGORY_LABELS[category] ?? category,
  }))
  .sort((a, b) => b.reelCount - a.reelCount);

const viableDifficulties = ["Beginner", "Intermediate", "Advanced"].filter(
  (d) => (difficultyCount.get(d) ?? 0) > 0,
);

const out = {
  generatedAt: new Date().toISOString(),
  totalReels: catalog.reels.length,
  catalogTopics,
  catalogTopicIds: [...catalogTopicIds],
  clusters,
  viableCategories,
  viableDifficulties,
  motivationKeys: Object.keys(MOTIVATIONS),
};

writeFileSync(
  path.join(root, "data/generated/onboarding-options.json"),
  JSON.stringify(out, null, 2),
);
console.log(`Wrote onboarding-options.json (${catalogTopics.length} topics, ${clusters.length} clusters)`);
