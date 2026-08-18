import type { InteractionEvent, Reel } from "@/lib/types";

/** A registered viewer. The password hash never leaves the server. */
export interface Account {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

/** Everything social the viewer has expressed, per storage key. */
export interface OnboardingPreferences {
  completedAt: string;
  /** Meaningful cluster ids from catalog-options (e.g. algorithms, career). */
  clusters?: string[];
  categories: string[];
  topics: string[];
  /** Key from MOTIVATIONS in data/ontology.ts */
  motivation: string;
  difficulty: string;
  /** Free-text goal — also used as a semantic search query. */
  goal: string;
}

import type { FeedRankCache } from "@/lib/feed/feed-cache";

export interface DislikeFeedback {
  reason: string;
  detail?: string;
  at: string;
}

export interface SocialState {
  follows: string[];
  dislikes: string[];
  mutedTopics: string[];
  saves: string[];
  likes: string[];
  /** Per-reel dislike reason from the feedback dialog. */
  dislikeFeedback: Record<string, DislikeFeedback>;
  /** Reels already served in feed/reels — excluded from future pages. */
  seenReels?: string[];
  /** Pre-ranked feed ids for fast pagination. */
  feedRank?: FeedRankCache;
  onboarding?: OnboardingPreferences | null;
}

export const EMPTY_SOCIAL: SocialState = {
  follows: [],
  dislikes: [],
  mutedTopics: [],
  saves: [],
  likes: [],
  dislikeFeedback: {},
  seenReels: [],
};

export const MAX_EVENTS_PER_SESSION = 400;

export type StoreDriver = "postgres" | "file";

export interface StoreStats {
  driver: StoreDriver;
  sessions: number;
  events: number;
  runtimeReels: number;
  accounts: number;
  postgresOk?: boolean;
}

export type {
  InteractionEvent,
  Reel,
};
