-- Upstream Postgres schema for Railway.
-- Run once against your Railway Postgres instance (Query tab or psql):
--   psql $DATABASE_URL -f migrations/001_init.sql

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interaction_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  reel_id TEXT NOT NULL,
  type TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_interaction_events_session_at
  ON interaction_events (session_id, at DESC);

CREATE TABLE IF NOT EXISTS session_social (
  session_id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS session_recommended (
  session_id TEXT PRIMARY KEY,
  reel_ids JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS runtime_reels (
  id TEXT PRIMARY KEY,
  reel JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_reels_created
  ON runtime_reels (created_at DESC);
