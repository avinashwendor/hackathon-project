import type { Category, Difficulty } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The interest ontology.

   Retrieval alone will happily hand back "another Java meme" because a Java
   meme is, embedding-wise, the nearest thing to a Java meme. The ontology is
   what lets the agent climb: every fine-grained topic declares the domain it
   belongs to and the motivation it usually serves, so a cluster of surface
   topics can be resolved into the one interest that explains all of them.
--------------------------------------------------------------------------- */

export interface TopicNode {
  id: string;
  label: string;
  category: Category;
  /** The broader field this topic sits inside. */
  domain: string;
  /** Why a student typically watches this — the top rung of the ladder. */
  motivation: string;
  /** Sibling topics that serve the same motivation at a higher value. */
  liftsTo: string[];
  aliases: string[];
}

export const DOMAINS = {
  SOFTWARE_ENGINEERING: "Software engineering craft",
  APPLIED_AI: "Applied AI and machine learning",
  SYSTEMS: "Systems and infrastructure",
  SECURITY: "Security and trust",
  HARDWARE: "Computing hardware",
  CAREER: "Career and industry navigation",
  CULTURE: "Developer culture and entertainment",
} as const;

export const MOTIVATIONS = {
  BECOME_EMPLOYABLE: "Wants to become a hireable software engineer",
  UNDERSTAND_DEEPLY: "Wants to understand how things actually work",
  BUILD_SOMETHING: "Wants to ship something real",
  BELONG: "Wants to feel part of the developer world",
  STAY_CURRENT: "Wants to keep up with what is changing",
  BUY_WELL: "Wants to make a good purchase decision",
} as const;

export const TOPICS: TopicNode[] = [
  // — Software engineering craft ——————————————————————————————
  {
    id: "java",
    label: "Java",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["jvm-internals", "collections", "concurrency", "spring-boot"],
    aliases: ["jdk", "javac", "java 21", "openjdk"],
  },
  {
    id: "jvm-internals",
    label: "JVM internals",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["garbage-collection", "jit", "memory-model"],
    aliases: ["hotspot", "bytecode", "class loading"],
  },
  {
    id: "jit",
    label: "JIT compilation",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["performance", "cpu-architecture"],
    aliases: ["just in time", "hotspot compiler", "c2", "warmup"],
  },
  {
    id: "garbage-collection",
    label: "Garbage collection",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["memory-model", "performance"],
    aliases: ["gc", "g1", "zgc", "heap"],
  },
  {
    id: "concurrency",
    label: "Concurrency",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["memory-model", "distributed-systems"],
    aliases: ["threads", "virtual threads", "loom", "async"],
  },
  {
    id: "spring-boot",
    label: "Spring Boot",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["api-design", "testing"],
    aliases: ["spring", "dependency injection"],
  },
  {
    id: "collections",
    label: "Collections & data structures in practice",
    category: "Java",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["hashing", "complexity"],
    aliases: ["hashmap", "arraylist", "treemap"],
  },
  {
    id: "debugging",
    label: "Debugging & profiling",
    category: "Other",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["performance", "observability"],
    aliases: ["profiler", "stack trace", "breakpoint", "flame graph"],
  },
  {
    id: "git",
    label: "Version control",
    category: "Other",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["code-review", "ci-cd"],
    aliases: ["git", "rebase", "merge conflict", "github"],
  },
  {
    id: "code-review",
    label: "Code review & collaboration",
    category: "Career",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["engineering-culture"],
    aliases: ["pull request", "pr", "review comments"],
  },
  {
    id: "testing",
    label: "Testing",
    category: "Other",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["ci-cd", "code-review"],
    aliases: ["unit test", "junit", "tdd", "integration test"],
  },

  // — Algorithms ————————————————————————————————————————
  {
    id: "dsa",
    label: "Data structures & algorithms",
    category: "DSA",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["complexity", "graphs", "dynamic-programming"],
    aliases: ["leetcode", "algorithms", "problem solving"],
  },
  {
    id: "complexity",
    label: "Time & space complexity",
    category: "DSA",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["performance"],
    aliases: ["big o", "asymptotic", "o(n)"],
  },
  {
    id: "graphs",
    label: "Graph algorithms",
    category: "DSA",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["distributed-systems"],
    aliases: ["bfs", "dfs", "dijkstra", "topological sort"],
  },
  {
    id: "dynamic-programming",
    label: "Dynamic programming",
    category: "DSA",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["complexity"],
    aliases: ["dp", "memoization", "tabulation"],
  },
  {
    id: "hashing",
    label: "Hashing",
    category: "DSA",
    domain: DOMAINS.SOFTWARE_ENGINEERING,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["caching", "distributed-systems"],
    aliases: ["hash function", "collision", "consistent hashing"],
  },

  // — Systems / HLD ————————————————————————————————————
  {
    id: "system-design",
    label: "System design",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["distributed-systems", "caching", "databases", "api-design"],
    aliases: ["hld", "high level design", "architecture"],
  },
  {
    id: "distributed-systems",
    label: "Distributed systems",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["consistency", "queues"],
    aliases: ["replication", "partitioning", "consensus", "raft"],
  },
  {
    id: "caching",
    label: "Caching",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["performance", "distributed-systems"],
    aliases: ["redis", "cache invalidation", "cdn"],
  },
  {
    id: "databases",
    label: "Databases",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["indexing", "consistency"],
    aliases: ["sql", "postgres", "index", "transaction"],
  },
  {
    id: "indexing",
    label: "Database indexing",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["performance"],
    aliases: ["b-tree", "query plan", "explain analyze"],
  },
  {
    id: "consistency",
    label: "Consistency & CAP",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["distributed-systems"],
    aliases: ["cap theorem", "eventual consistency", "acid"],
  },
  {
    id: "queues",
    label: "Queues & streaming",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["distributed-systems"],
    aliases: ["kafka", "rabbitmq", "backpressure", "pub sub"],
  },
  {
    id: "api-design",
    label: "API design",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["system-design"],
    aliases: ["rest", "graphql", "idempotency", "pagination"],
  },
  {
    id: "performance",
    label: "Performance engineering",
    category: "HLD",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["caching", "indexing"],
    aliases: ["latency", "throughput", "p99", "benchmark"],
  },
  {
    id: "observability",
    label: "Observability",
    category: "Cloud",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["performance"],
    aliases: ["tracing", "metrics", "logs", "opentelemetry"],
  },

  // — Cloud ————————————————————————————————————————————
  {
    id: "cloud",
    label: "Cloud fundamentals",
    category: "Cloud",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["containers", "ci-cd", "cost-engineering"],
    aliases: ["aws", "gcp", "azure", "s3", "ec2"],
  },
  {
    id: "containers",
    label: "Containers & orchestration",
    category: "Cloud",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["ci-cd", "observability"],
    aliases: ["docker", "kubernetes", "k8s", "image layers"],
  },
  {
    id: "ci-cd",
    label: "CI/CD & deployment",
    category: "Cloud",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["observability"],
    aliases: ["github actions", "pipeline", "blue green", "rollback"],
  },
  {
    id: "cost-engineering",
    label: "Cloud cost engineering",
    category: "Cloud",
    domain: DOMAINS.SYSTEMS,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["performance"],
    aliases: ["egress", "bill", "rightsizing"],
  },

  // — Security ——————————————————————————————————————————
  {
    id: "security",
    label: "Security fundamentals",
    category: "Cybersecurity",
    domain: DOMAINS.SECURITY,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["auth", "web-security", "cryptography"],
    aliases: ["infosec", "threat model", "vulnerability"],
  },
  {
    id: "auth",
    label: "Authentication & sessions",
    category: "Cybersecurity",
    domain: DOMAINS.SECURITY,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["cryptography", "api-design"],
    aliases: ["jwt", "oauth", "session", "cookie"],
  },
  {
    id: "web-security",
    label: "Web attack surface",
    category: "Cybersecurity",
    domain: DOMAINS.SECURITY,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["auth", "security"],
    aliases: ["xss", "csrf", "sql injection", "ssrf"],
  },
  {
    id: "cryptography",
    label: "Applied cryptography",
    category: "Cybersecurity",
    domain: DOMAINS.SECURITY,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["security"],
    aliases: ["tls", "hashing password", "bcrypt", "aes"],
  },

  // — AI ————————————————————————————————————————————————
  {
    id: "ai",
    label: "AI & machine learning",
    category: "AI",
    domain: DOMAINS.APPLIED_AI,
    motivation: MOTIVATIONS.STAY_CURRENT,
    liftsTo: ["embeddings", "transformers", "rag", "ml-engineering"],
    aliases: ["artificial intelligence", "machine learning", "llm", "gpt"],
  },
  {
    id: "embeddings",
    label: "Embeddings & vector search",
    category: "AI",
    domain: DOMAINS.APPLIED_AI,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["rag", "recommenders"],
    aliases: ["vector database", "cosine similarity", "ann", "hnsw"],
  },
  {
    id: "transformers",
    label: "Transformer architecture",
    category: "AI",
    domain: DOMAINS.APPLIED_AI,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["ml-engineering"],
    aliases: ["attention", "self attention", "tokens", "context window"],
  },
  {
    id: "rag",
    label: "Retrieval-augmented generation",
    category: "AI",
    domain: DOMAINS.APPLIED_AI,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["embeddings", "ml-engineering"],
    aliases: ["retrieval", "chunking", "reranking"],
  },
  {
    id: "recommenders",
    label: "Recommendation systems",
    category: "AI",
    domain: DOMAINS.APPLIED_AI,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["embeddings", "ml-engineering"],
    aliases: ["collaborative filtering", "ranking", "feed algorithm"],
  },
  {
    id: "ml-engineering",
    label: "ML engineering",
    category: "AI",
    domain: DOMAINS.APPLIED_AI,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["observability", "cloud"],
    aliases: ["mlops", "inference", "serving", "evaluation"],
  },

  // — Hardware ——————————————————————————————————————————
  {
    id: "hardware",
    label: "Computer hardware",
    category: "Hardware",
    domain: DOMAINS.HARDWARE,
    motivation: MOTIVATIONS.BUY_WELL,
    liftsTo: ["cpu-architecture", "memory-model", "gpu"],
    aliases: ["laptop", "cpu", "ram", "ssd", "benchmark"],
  },
  {
    id: "cpu-architecture",
    label: "CPU architecture",
    category: "Hardware",
    domain: DOMAINS.HARDWARE,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["performance", "memory-model"],
    aliases: ["pipeline", "cache line", "branch prediction", "arm"],
  },
  {
    id: "memory-model",
    label: "Memory hierarchy",
    category: "Hardware",
    domain: DOMAINS.HARDWARE,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["performance", "cpu-architecture"],
    aliases: ["l1 cache", "ram", "locality", "false sharing"],
  },
  {
    id: "gpu",
    label: "GPUs & accelerators",
    category: "Hardware",
    domain: DOMAINS.HARDWARE,
    motivation: MOTIVATIONS.UNDERSTAND_DEEPLY,
    liftsTo: ["ml-engineering", "cpu-architecture"],
    aliases: ["cuda", "vram", "tensor core", "nvidia"],
  },

  // — Career ————————————————————————————————————————————
  {
    id: "career",
    label: "Engineering career",
    category: "Career",
    domain: DOMAINS.CAREER,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["interviews", "portfolio", "engineering-culture"],
    aliases: ["job", "internship", "placement", "salary", "resume"],
  },
  {
    id: "interviews",
    label: "Technical interviews",
    category: "Career",
    domain: DOMAINS.CAREER,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["dsa", "system-design", "communication"],
    aliases: ["interview", "coding round", "onsite", "dsa round"],
  },
  {
    id: "portfolio",
    label: "Portfolio & projects",
    category: "Career",
    domain: DOMAINS.CAREER,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["build-in-public", "testing"],
    aliases: ["side project", "github profile", "resume project"],
  },
  {
    id: "communication",
    label: "Engineering communication",
    category: "Career",
    domain: DOMAINS.CAREER,
    motivation: MOTIVATIONS.BECOME_EMPLOYABLE,
    liftsTo: ["code-review"],
    aliases: ["explain", "design doc", "standup", "writing"],
  },
  {
    id: "engineering-culture",
    label: "How engineering teams work",
    category: "Career",
    domain: DOMAINS.CAREER,
    motivation: MOTIVATIONS.BELONG,
    liftsTo: ["code-review", "communication"],
    aliases: ["on call", "sprint", "team", "day in the life"],
  },
  {
    id: "build-in-public",
    label: "Building in public",
    category: "Career",
    domain: DOMAINS.CAREER,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["portfolio"],
    aliases: ["indie hacker", "ship", "launch"],
  },

  // — Culture ————————————————————————————————————————————
  {
    id: "dev-humour",
    label: "Developer humour",
    category: "Other",
    domain: DOMAINS.CULTURE,
    motivation: MOTIVATIONS.BELONG,
    liftsTo: ["engineering-culture", "java", "debugging"],
    aliases: ["meme", "relatable", "joke", "pov"],
  },
  {
    id: "tech-news",
    label: "Tech news",
    category: "Other",
    domain: DOMAINS.CULTURE,
    motivation: MOTIVATIONS.STAY_CURRENT,
    liftsTo: ["ai", "cloud", "hardware"],
    aliases: ["announcement", "release", "launch", "acquisition"],
  },
  {
    id: "gaming",
    label: "Gaming",
    category: "Other",
    domain: DOMAINS.CULTURE,
    motivation: MOTIVATIONS.BELONG,
    liftsTo: ["gpu", "game-dev"],
    aliases: ["fps", "clutch", "ranked", "gameplay"],
  },
  {
    id: "game-dev",
    label: "Game development",
    category: "Other",
    domain: DOMAINS.CULTURE,
    motivation: MOTIVATIONS.BUILD_SOMETHING,
    liftsTo: ["gpu", "performance"],
    aliases: ["unity", "godot", "shader", "game loop"],
  },
  {
    id: "entertainment",
    label: "General entertainment",
    category: "Other",
    domain: DOMAINS.CULTURE,
    motivation: MOTIVATIONS.BELONG,
    liftsTo: [],
    aliases: ["dance", "comedy", "food", "travel", "prank"],
  },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export function topicsForCategory(category: Category): TopicNode[] {
  return TOPICS.filter((t) => t.category === category);
}

/**
 * Resolve free text to ontology topics via label + alias matching.
 *
 * Matching is done on a singularised haystack so "my database keeps timing out"
 * finds the `databases` topic. Without that, plain-English queries silently miss
 * the topic slots that make the offline embedding space work.
 */
export function matchTopics(text: string): TopicNode[] {
  const normalise = (input: string) =>
    ` ${input
      .toLowerCase()
      .replace(/[^a-z0-9+#\s-]/g, " ")
      .split(/\s+/)
      .map((word) => (word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word))
      .join(" ")} `;

  const haystack = normalise(text);
  return TOPICS.filter((t) => {
    const needles = [t.id.replace(/-/g, " "), t.label, ...t.aliases].map((n) => normalise(n).trim());
    return needles.some((n) => n.length > 1 && haystack.includes(` ${n} `));
  });
}

/** The domain that explains the largest share of a topic set. */
export function dominantDomain(topicIds: string[]): { domain: string; share: number } {
  const counts = new Map<string, number>();
  for (const id of topicIds) {
    const node = TOPIC_BY_ID.get(id);
    if (!node) continue;
    counts.set(node.domain, (counts.get(node.domain) ?? 0) + 1);
  }
  let best = { domain: DOMAINS.SOFTWARE_ENGINEERING as string, share: 0 };
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  for (const [domain, n] of counts) {
    if (n > best.share * total) best = { domain, share: n / total };
  }
  return best;
}

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
};
