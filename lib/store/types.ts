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
export interface SocialState {
  follows: string[];
  dislikes: string[];
  mutedTopics: string[];
  saves: string[];
  likes: string[];
}

export const EMPTY_SOCIAL: SocialState = {
  follows: [],
  dislikes: [],
  mutedTopics: [],
  saves: [],
  likes: [],
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
