import type { Reel } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The hype guardrail.

   The brief names this failure directly: a system that optimises engagement
   will happily serve "10 AI tools that will get you a job", because that reel
   wins on every engagement metric there is. So the filter deliberately runs
   *against* popularity.

   It is two layers. A lexicon catches the grammar of hype — outcome promises,
   scarcity, secrecy, engagement bait — and is cheap, deterministic and
   auditable. The LLM reranker then makes the judgement call on anything
   borderline. The lexicon alone is what keeps the guarantee when the model is
   unavailable.
--------------------------------------------------------------------------- */

interface HypePattern {
  pattern: RegExp;
  kind: string;
  weight: number;
}

const PATTERNS: HypePattern[] = [
  // Outcome promises the content cannot possibly deliver.
  { pattern: /\b(will|guaranteed to|gonna)\s+(get|land|make)\s+you\s+(a\s+)?(job|offer|package|placement)/i, kind: "outcome promise", weight: 1 },
  { pattern: /\breplace\s+your\s+(degree|college|job|career)/i, kind: "outcome promise", weight: 1 },
  { pattern: /\bcrack(ed)?\s+(a\s+)?[\d.]+\s*(lpa|lakh|k\b|crore)/i, kind: "salary flex", weight: 0.9 },
  { pattern: /\b(in|within)\s+(just\s+)?\d+\s*(days?|weeks?|months?)\b.*\b(job|offer|master|learn)/i, kind: "impossible timeline", weight: 0.85 },
  { pattern: /\bmaster\s+\w+\s+in\s+\d+\s*(minutes?|days?|hours?)/i, kind: "impossible timeline", weight: 0.8 },

  // Secrecy and conspiracy — the "they don't want you to know" register.
  { pattern: /\bnobody('s| is)?\s+(talking about|telling you|sharing)/i, kind: "false scarcity", weight: 0.8 },
  { pattern: /\b(they|colleges?|companies)\s+(don'?t|do not)\s+want\s+you\s+to\s+know/i, kind: "conspiracy framing", weight: 0.9 },
  { pattern: /\b(secret|hidden|underrated)\s+(roadmap|trick|hack|method|list)/i, kind: "false scarcity", weight: 0.75 },
  { pattern: /\b(unfair advantage|cheat code|shortcut)\b/i, kind: "false scarcity", weight: 0.7 },

  // Engagement bait.
  { pattern: /\b(stop scrolling|save this|save before|don'?t skip)\b/i, kind: "engagement bait", weight: 0.7 },
  { pattern: /\bcomment\s+(the\s+word\s+)?["“]?[A-Z]{3,}["”]?/,  kind: "engagement bait", weight: 0.8 },
  { pattern: /\b(dm|link in bio)\b.*\b(free|list|sheet|roadmap)/i, kind: "lead capture", weight: 0.8 },
  { pattern: /\b\d{1,2}%\s+of\s+(you|students|people|devs)\b/i, kind: "manufactured stat", weight: 0.75 },
  { pattern: /\bnumber\s+\d+\s+(is|will)\s+(insane|shock|blow)/i, kind: "listicle bait", weight: 0.8 },

  // Listicle shape: "N tools/tricks that ..." with a promise attached.
  { pattern: /^\s*\d+\s+(ai\s+)?(tools?|tricks?|hacks?|websites?|extensions?)\b/i, kind: "listicle", weight: 0.55 },

  // Patterns that only show up once you look at real short-form descriptions.
  { pattern: /\bcomment\s+(the\s+)?(answer|word|below|"[^"]{2,20}")/i, kind: "engagement bait", weight: 0.7 },
  { pattern: /\blink\s+in\s+bio\b/i, kind: "lead capture", weight: 0.6 },
  { pattern: /\bfree\s+(ai\s+)?(toolkit|guide|ebook|checklist|sheet|course)\b/i, kind: "lead capture", weight: 0.7 },
  { pattern: /\bonly\s+\d{1,2}%\s+of\s+\w+/i, kind: "manufactured stat", weight: 0.75 },
  { pattern: /\b(getting ahead|left behind)\s+in\s+20\d\d/i, kind: "fomo", weight: 0.7 },
];

export interface HypeVerdict {
  /** 0 (substantive) … 1 (pure hype). */
  score: number;
  /** True once the reel should not be recommended regardless of its ranking. */
  blocked: boolean;
  kinds: string[];
  /** Quoted phrases, so the UI can show what tripped it rather than a verdict. */
  matched: string[];
}

/** Above this, a reel is refused no matter how well it scores on relevance. */
export const HYPE_BLOCK_THRESHOLD = 0.5;

export function detectHype(text: string, declaredMarkers: string[] = []): HypeVerdict {
  const kinds = new Set<string>();
  const matched: string[] = [];
  let score = 0;

  for (const { pattern, kind, weight } of PATTERNS) {
    const hit = text.match(pattern);
    if (!hit) continue;
    kinds.add(kind);
    matched.push(hit[0].trim().slice(0, 60));
    // Saturating sum: three weak markers should not out-score one blatant one.
    score = score + weight * (1 - score);
  }

  /*
   * Declared markers come from two very different places: the hand-authored
   * corpus, where they are ground truth, and the language model that enriched
   * the imported catalog, where they are a judgement call — and a noisy one.
   * Reviewing the imported set showed roughly half the model's markers were
   * descriptive phrases, not promises ("critical vulnerability", "controversial
   * opinions"). A false positive here permanently deletes a good reel from the
   * recommendable pool, which is a worse failure than letting one weak reel
   * through.
   *
   * So the lexicon is the only thing that can block on its own. A declared
   * marker that the lexicon also recognises is corroborated and counts fully;
   * an uncorroborated one adds weight but cannot reach the threshold alone.
   */
  for (const marker of declaredMarkers) {
    const corroborated = PATTERNS.some(({ pattern }) => pattern.test(marker));
    if (corroborated) {
      kinds.add("corroborated marker");
      matched.push(marker);
      score = score + 0.75 * (1 - score);
    } else {
      kinds.add("advisory marker");
      score = score + 0.15 * (1 - score);
    }
  }

  return {
    score: Number(score.toFixed(3)),
    blocked: score >= HYPE_BLOCK_THRESHOLD,
    kinds: [...kinds],
    matched: [...new Set(matched)],
  };
}

export function judgeReel(reel: Reel): HypeVerdict {
  const text = `${reel.title}\n${reel.caption}\n${reel.transcript}`;
  const verdict = detectHype(text, reel.hypeMarkers);

  // Substance is the second gate. A reel can be free of hype language and still
  // be empty — a pure meme has nothing to teach, and that is a different
  // rejection reason with a different message.
  return verdict;
}

/** A single number combining "is it honest" with "does it teach anything". */
export function substanceScore(reel: Reel): number {
  const hype = judgeReel(reel);
  return Number(Math.max(0, reel.substance * (1 - hype.score * 0.85)).toFixed(3));
}
