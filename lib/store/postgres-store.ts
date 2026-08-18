import { getDb, sql } from "@/lib/db/client";
import type { InteractionEvent, Reel } from "@/lib/types";
import {
  EMPTY_SOCIAL,
  MAX_EVENTS_PER_SESSION,
  type Account,
  type SocialState,
  type StoreStats,
} from "./types";

function eventPayload(event: InteractionEvent): Record<string, unknown> {
  const { id, sessionId, reelId, type, at, ...rest } = event;
  void id;
  void sessionId;
  void reelId;
  void type;
  void at;
  return rest;
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function rowToEvent(row: {
  id: string;
  session_id: string;
  reel_id: string;
  type: string;
  at: Date;
  payload: unknown;
}): InteractionEvent {
  const extra = parseJsonColumn<
    Omit<InteractionEvent, "id" | "sessionId" | "reelId" | "type" | "at">
  >(row.payload, {});
  return {
    id: row.id,
    sessionId: row.session_id,
    reelId: row.reel_id,
    type: row.type as InteractionEvent["type"],
    at: row.at.toISOString(),
    ...extra,
  };
}

async function trimSessionEvents(sessionId: string): Promise<void> {
  const db = getDb();
  const excess = await db
    .selectFrom("interaction_events")
    .select("id")
    .where("session_id", "=", sessionId)
    .orderBy("at", "desc")
    .offset(MAX_EVENTS_PER_SESSION)
    .execute();

  if (!excess.length) return;
  await db
    .deleteFrom("interaction_events")
    .where(
      "id",
      "in",
      excess.map((r) => r.id),
    )
    .execute();
}

export async function appendEvents(sessionId: string, events: InteractionEvent[]): Promise<number> {
  if (!events.length) return (await readEvents(sessionId)).length;
  const db = getDb();

  await db
    .insertInto("interaction_events")
    .values(
      events.map((event) => ({
        id: event.id,
        session_id: sessionId,
        reel_id: event.reelId,
        type: event.type,
        at: new Date(event.at),
        payload: JSON.stringify(eventPayload(event)),
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await trimSessionEvents(sessionId);

  const count = await db
    .selectFrom("interaction_events")
    .select(db.fn.count<number>("id").as("count"))
    .where("session_id", "=", sessionId)
    .executeTakeFirst();

  return Number(count?.count ?? 0);
}

export async function readEvents(sessionId: string): Promise<InteractionEvent[]> {
  const rows = await getDb()
    .selectFrom("interaction_events")
    .selectAll()
    .where("session_id", "=", sessionId)
    .orderBy("at", "asc")
    .limit(MAX_EVENTS_PER_SESSION)
    .execute();

  return rows.map(rowToEvent);
}

export async function clearSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.deleteFrom("interaction_events").where("session_id", "=", sessionId).execute();
  await db.deleteFrom("session_recommended").where("session_id", "=", sessionId).execute();
}

export async function markRecommended(sessionId: string, reelId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom("session_recommended")
    .select("reel_ids")
    .where("session_id", "=", sessionId)
    .executeTakeFirst();

  const reelIds = [
    ...new Set([
      ...(existing
        ? parseJsonColumn<string[]>(existing.reel_ids, [])
        : []),
      reelId,
    ]),
  ].slice(-30);

  await db
    .insertInto("session_recommended")
    .values({ session_id: sessionId, reel_ids: JSON.stringify(reelIds) })
    .onConflict((oc) =>
      oc.column("session_id").doUpdateSet({ reel_ids: JSON.stringify(reelIds) }),
    )
    .execute();
}

export async function readRecommended(sessionId: string): Promise<string[]> {
  const row = await getDb()
    .selectFrom("session_recommended")
    .select("reel_ids")
    .where("session_id", "=", sessionId)
    .executeTakeFirst();
  if (!row) return [];
  return parseJsonColumn<string[]>(row.reel_ids, []);
}

export async function addReel(reel: Reel): Promise<void> {
  await getDb()
    .insertInto("runtime_reels")
    .values({ id: reel.id, reel: JSON.stringify(reel) })
    .onConflict((oc) => oc.column("id").doUpdateSet({ reel: JSON.stringify(reel) }))
    .execute();

  const stale = await getDb()
    .selectFrom("runtime_reels")
    .select("id")
    .orderBy("created_at", "desc")
    .offset(200)
    .execute();

  if (stale.length) {
    await getDb()
      .deleteFrom("runtime_reels")
      .where(
        "id",
        "in",
        stale.map((r) => r.id),
      )
      .execute();
  }
}

export async function readRuntimeReels(): Promise<Reel[]> {
  const rows = await getDb()
    .selectFrom("runtime_reels")
    .select(["reel"])
    .orderBy("created_at", "desc")
    .limit(200)
    .execute();
  return rows.map((r) => parseJsonColumn<Reel>(r.reel, {} as Reel)).filter((r) => r.id);
}

export async function storeStats(): Promise<StoreStats> {
  const db = getDb();
  const [sessions, events, runtimeReels, accounts] = await Promise.all([
    db
      .selectFrom("interaction_events")
      .select("session_id")
      .distinct()
      .execute()
      .then((r) => r.length),
    db
      .selectFrom("interaction_events")
      .select(db.fn.count<number>("id").as("count"))
      .executeTakeFirst()
      .then((r) => Number(r?.count ?? 0)),
    db
      .selectFrom("runtime_reels")
      .select(db.fn.count<number>("id").as("count"))
      .executeTakeFirst()
      .then((r) => Number(r?.count ?? 0)),
    db
      .selectFrom("accounts")
      .select(db.fn.count<number>("id").as("count"))
      .executeTakeFirst()
      .then((r) => Number(r?.count ?? 0)),
  ]);

  return { driver: "postgres", sessions, events, runtimeReels, accounts, postgresOk: true };
}

export async function getAccountById(id: string): Promise<Account | null> {
  const row = await getDb()
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  const row = await getDb()
    .selectFrom("accounts")
    .selectAll()
    .where("email", "=", email.trim().toLowerCase())
    .executeTakeFirst();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
  };
}

export async function saveAccount(account: Account): Promise<void> {
  await getDb()
    .insertInto("accounts")
    .values({
      id: account.id,
      email: account.email.trim().toLowerCase(),
      name: account.name,
      password_hash: account.passwordHash,
      created_at: account.createdAt,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        email: account.email.trim().toLowerCase(),
        name: account.name,
        password_hash: account.passwordHash,
      }),
    )
    .execute();
}

export async function migrateSession(fromKey: string, toKey: string): Promise<number> {
  if (fromKey === toKey) return 0;
  const db = getDb();

  const moved = await db
    .updateTable("interaction_events")
    .set({ session_id: toKey })
    .where("session_id", "=", fromKey)
    .executeTakeFirst();

  await trimSessionEvents(toKey);

  const fromSocial = await readSocial(fromKey);
  const toSocial = await readSocial(toKey);
  const merged: SocialState = {
    follows: [...new Set([...toSocial.follows, ...fromSocial.follows])],
    dislikes: [...new Set([...toSocial.dislikes, ...fromSocial.dislikes])],
    mutedTopics: [...new Set([...toSocial.mutedTopics, ...fromSocial.mutedTopics])],
    saves: [...new Set([...toSocial.saves, ...fromSocial.saves])],
    likes: [...new Set([...toSocial.likes, ...fromSocial.likes])],
    dislikeFeedback: { ...fromSocial.dislikeFeedback, ...toSocial.dislikeFeedback },
    seenReels: [...new Set([...(toSocial.seenReels ?? []), ...(fromSocial.seenReels ?? [])])],
    onboarding: toSocial.onboarding ?? fromSocial.onboarding ?? null,
  };
  await db
    .insertInto("session_social")
    .values({ session_id: toKey, state: JSON.stringify(merged) })
    .onConflict((oc) => oc.column("session_id").doUpdateSet({ state: JSON.stringify(merged) }))
    .execute();
  await db.deleteFrom("session_social").where("session_id", "=", fromKey).execute();

  const fromRec = await readRecommended(fromKey);
  const toRec = await readRecommended(toKey);
  const reelIds = [...new Set([...toRec, ...fromRec])].slice(-30);
  await db
    .insertInto("session_recommended")
    .values({ session_id: toKey, reel_ids: JSON.stringify(reelIds) })
    .onConflict((oc) => oc.column("session_id").doUpdateSet({ reel_ids: JSON.stringify(reelIds) }))
    .execute();
  await db.deleteFrom("session_recommended").where("session_id", "=", fromKey).execute();

  return Number(moved.numUpdatedRows ?? 0n);
}

export async function readSocial(key: string): Promise<SocialState> {
  const row = await getDb()
    .selectFrom("session_social")
    .select("state")
    .where("session_id", "=", key)
    .executeTakeFirst();
  if (!row) return { ...EMPTY_SOCIAL };
  return { ...EMPTY_SOCIAL, ...parseJsonColumn<Partial<SocialState>>(row.state, {}) };
}

export async function updateSocial(
  key: string,
  mutate: (current: SocialState) => SocialState,
): Promise<SocialState> {
  const current = await readSocial(key);
  const next = mutate(current);
  const bounded: SocialState = {
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

  await getDb()
    .insertInto("session_social")
    .values({ session_id: key, state: JSON.stringify(bounded) })
    .onConflict((oc) => oc.column("session_id").doUpdateSet({ state: JSON.stringify(bounded) }))
    .execute();

  return bounded;
}

/** Count rows — sanity check after migration. */
export async function postgresTableCounts(): Promise<Record<string, number>> {
  const db = getDb();
  const [accounts, events, social, recommended, reels] = await Promise.all([
    sql<{ count: string }>`select count(*)::text as count from accounts`.execute(db),
    sql<{ count: string }>`select count(*)::text as count from interaction_events`.execute(db),
    sql<{ count: string }>`select count(*)::text as count from session_social`.execute(db),
    sql<{ count: string }>`select count(*)::text as count from session_recommended`.execute(db),
    sql<{ count: string }>`select count(*)::text as count from runtime_reels`.execute(db),
  ]);
  return {
    accounts: Number(accounts.rows[0]?.count ?? 0),
    interaction_events: Number(events.rows[0]?.count ?? 0),
    session_social: Number(social.rows[0]?.count ?? 0),
    session_recommended: Number(recommended.rows[0]?.count ?? 0),
    runtime_reels: Number(reels.rows[0]?.count ?? 0),
  };
}
