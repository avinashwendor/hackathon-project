import { promises as fs } from "node:fs";
import path from "node:path";
import type { InteractionEvent, Reel } from "@/lib/types";
import {
  EMPTY_SOCIAL,
  MAX_EVENTS_PER_SESSION,
  type Account,
  type SocialState,
  type StoreStats,
} from "./types";

const SNAPSHOT = path.join(process.cwd(), "data", "generated", "runtime.json");

interface Snapshot {
  events: Record<string, InteractionEvent[]>;
  reels: Reel[];
  recommended: Record<string, string[]>;
  accounts: Record<string, Account>;
  social: Record<string, SocialState>;
}

const state: Snapshot = { events: {}, reels: [], recommended: {}, accounts: {}, social: {} };
let loaded = false;
let writeTimer: NodeJS.Timeout | null = null;

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(SNAPSHOT, "utf8");
    const parsed = JSON.parse(raw) as Snapshot;
    Object.assign(state, {
      events: parsed.events ?? {},
      reels: parsed.reels ?? [],
      recommended: parsed.recommended ?? {},
      accounts: parsed.accounts ?? {},
      social: parsed.social ?? {},
    });
  } catch {
    /* first run or read-only fs */
  }
}

function persistSoon(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try {
      await fs.mkdir(path.dirname(SNAPSHOT), { recursive: true });
      await fs.writeFile(SNAPSHOT, JSON.stringify(state), "utf8");
    } catch {
      /* ephemeral filesystem */
    }
  }, 1500);
  writeTimer.unref?.();
}

export async function appendEvents(sessionId: string, events: InteractionEvent[]): Promise<number> {
  await load();
  const list = state.events[sessionId] ?? [];
  list.push(...events);
  state.events[sessionId] = list.slice(-MAX_EVENTS_PER_SESSION);
  persistSoon();
  return state.events[sessionId].length;
}

export async function readEvents(sessionId: string): Promise<InteractionEvent[]> {
  await load();
  return state.events[sessionId] ?? [];
}

export async function clearSession(sessionId: string): Promise<void> {
  await load();
  delete state.events[sessionId];
  delete state.recommended[sessionId];
  persistSoon();
}

export async function markRecommended(sessionId: string, reelId: string): Promise<void> {
  await load();
  const list = state.recommended[sessionId] ?? [];
  if (!list.includes(reelId)) list.push(reelId);
  state.recommended[sessionId] = list.slice(-30);
  persistSoon();
}

export async function readRecommended(sessionId: string): Promise<string[]> {
  await load();
  return state.recommended[sessionId] ?? [];
}

export async function addReel(reel: Reel): Promise<void> {
  await load();
  state.reels = [reel, ...state.reels.filter((r) => r.id !== reel.id)].slice(0, 200);
  persistSoon();
}

export async function readRuntimeReels(): Promise<Reel[]> {
  await load();
  return state.reels;
}

export async function storeStats(): Promise<StoreStats> {
  await load();
  return {
    driver: "file",
    sessions: Object.keys(state.events).length,
    events: Object.values(state.events).reduce((sum, list) => sum + list.length, 0),
    runtimeReels: state.reels.length,
    accounts: Object.keys(state.accounts).length,
  };
}

export async function getAccountById(id: string): Promise<Account | null> {
  await load();
  return state.accounts[id] ?? null;
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  await load();
  const normalised = email.trim().toLowerCase();
  return Object.values(state.accounts).find((a) => a.email === normalised) ?? null;
}

export async function saveAccount(account: Account): Promise<void> {
  await load();
  state.accounts[account.id] = { ...account, email: account.email.trim().toLowerCase() };
  persistSoon();
}

export async function migrateSession(fromKey: string, toKey: string): Promise<number> {
  await load();
  if (fromKey === toKey) return 0;

  const incoming = state.events[fromKey] ?? [];
  if (incoming.length) {
    const existing = state.events[toKey] ?? [];
    state.events[toKey] = [...existing, ...incoming.map((e) => ({ ...e, sessionId: toKey }))].slice(
      -MAX_EVENTS_PER_SESSION,
    );
    delete state.events[fromKey];
  }

  const social = state.social[fromKey];
  if (social) {
    const target = state.social[toKey] ?? { ...EMPTY_SOCIAL };
    state.social[toKey] = {
      follows: [...new Set([...target.follows, ...social.follows])],
      dislikes: [...new Set([...target.dislikes, ...social.dislikes])],
      mutedTopics: [...new Set([...target.mutedTopics, ...social.mutedTopics])],
      saves: [...new Set([...target.saves, ...social.saves])],
      likes: [...new Set([...target.likes, ...social.likes])],
      dislikeFeedback: { ...social.dislikeFeedback, ...target.dislikeFeedback },
      seenReels: [...new Set([...(target.seenReels ?? []), ...(social.seenReels ?? [])])],
      onboarding: target.onboarding ?? social.onboarding ?? null,
    };
    delete state.social[fromKey];
  }

  const recommended = state.recommended[fromKey];
  if (recommended) {
    state.recommended[toKey] = [
      ...new Set([...(state.recommended[toKey] ?? []), ...recommended]),
    ].slice(-30);
    delete state.recommended[fromKey];
  }

  persistSoon();
  return incoming.length;
}

export async function readSocial(key: string): Promise<SocialState> {
  await load();
  return state.social[key] ?? { ...EMPTY_SOCIAL };
}

export async function updateSocial(
  key: string,
  mutate: (current: SocialState) => SocialState,
): Promise<SocialState> {
  await load();
  const next = mutate(state.social[key] ?? { ...EMPTY_SOCIAL });
  state.social[key] = {
    follows: next.follows.slice(-200),
    dislikes: next.dislikes.slice(-500),
    mutedTopics: next.mutedTopics.slice(-50),
    saves: next.saves.slice(-500),
    likes: next.likes.slice(-500),
    dislikeFeedback: Object.fromEntries(
      Object.entries(next.dislikeFeedback ?? {}).slice(-500),
    ),
    seenReels: (next.seenReels ?? []).slice(-800),
    onboarding: next.onboarding ?? null,
  };
  persistSoon();
  return state.social[key];
}
