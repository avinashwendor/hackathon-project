import type { ColumnType } from "kysely";
import type { Reel } from "@/lib/types";
import type { SocialState } from "@/lib/store/types";

export interface Database {
  accounts: AccountsTable;
  interaction_events: InteractionEventsTable;
  session_social: SessionSocialTable;
  session_recommended: SessionRecommendedTable;
  runtime_reels: RuntimeReelsTable;
}

export interface AccountsTable {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: ColumnType<Date, string | Date, never>;
}

export interface InteractionEventsTable {
  id: string;
  session_id: string;
  reel_id: string;
  type: string;
  at: ColumnType<Date, string | Date, never>;
  /** JSON-serialised optional event fields (watchedMs, completion, …). */
  payload: string;
}

export interface SessionSocialTable {
  session_id: string;
  /** JSON-serialised SocialState. */
  state: string;
}

export interface SessionRecommendedTable {
  session_id: string;
  /** JSON-serialised string[]. */
  reel_ids: string;
}

export interface RuntimeReelsTable {
  id: string;
  /** JSON-serialised Reel. */
  reel: string;
  created_at: ColumnType<Date, string | Date | undefined, never>;
}

export type { Reel, SocialState };
