/* ---------------------------------------------------------------------------
   Session store facade.

   Railway production: Postgres when DATABASE_URL is set (accounts, events,
   social graph survive deploys). Local dev: JSON snapshot in data/generated/.

   Vector search and embeddings are separate — see lib/vector and lib/embeddings.
--------------------------------------------------------------------------- */

import { config } from "@/lib/config";
import * as fileStore from "./file-store";
import * as postgresStore from "./postgres-store";

export type { Account, SocialState, StoreStats, StoreDriver } from "./types";
export { EMPTY_SOCIAL } from "./types";

const isPostgres = () => Boolean(config.database.url);

export const appendEvents = (...args: Parameters<typeof fileStore.appendEvents>) =>
  isPostgres() ? postgresStore.appendEvents(...args) : fileStore.appendEvents(...args);

export const readEvents = (...args: Parameters<typeof fileStore.readEvents>) =>
  isPostgres() ? postgresStore.readEvents(...args) : fileStore.readEvents(...args);

export const clearSession = (...args: Parameters<typeof fileStore.clearSession>) =>
  isPostgres() ? postgresStore.clearSession(...args) : fileStore.clearSession(...args);

export const markRecommended = (...args: Parameters<typeof fileStore.markRecommended>) =>
  isPostgres() ? postgresStore.markRecommended(...args) : fileStore.markRecommended(...args);

export const readRecommended = (...args: Parameters<typeof fileStore.readRecommended>) =>
  isPostgres() ? postgresStore.readRecommended(...args) : fileStore.readRecommended(...args);

export const addReel = (...args: Parameters<typeof fileStore.addReel>) =>
  isPostgres() ? postgresStore.addReel(...args) : fileStore.addReel(...args);

export const readRuntimeReels = (...args: Parameters<typeof fileStore.readRuntimeReels>) =>
  isPostgres() ? postgresStore.readRuntimeReels(...args) : fileStore.readRuntimeReels(...args);

export const getAccountById = (...args: Parameters<typeof fileStore.getAccountById>) =>
  isPostgres() ? postgresStore.getAccountById(...args) : fileStore.getAccountById(...args);

export const getAccountByEmail = (...args: Parameters<typeof fileStore.getAccountByEmail>) =>
  isPostgres() ? postgresStore.getAccountByEmail(...args) : fileStore.getAccountByEmail(...args);

export const saveAccount = (...args: Parameters<typeof fileStore.saveAccount>) =>
  isPostgres() ? postgresStore.saveAccount(...args) : fileStore.saveAccount(...args);

export const migrateSession = (...args: Parameters<typeof fileStore.migrateSession>) =>
  isPostgres() ? postgresStore.migrateSession(...args) : fileStore.migrateSession(...args);

export const readSocial = (...args: Parameters<typeof fileStore.readSocial>) =>
  isPostgres() ? postgresStore.readSocial(...args) : fileStore.readSocial(...args);

export const updateSocial = (...args: Parameters<typeof fileStore.updateSocial>) =>
  isPostgres() ? postgresStore.updateSocial(...args) : fileStore.updateSocial(...args);

export async function storeStats() {
  if (isPostgres()) {
    try {
      return await postgresStore.storeStats();
    } catch (err) {
      console.error("[store] Postgres unavailable, falling back to file store:", err);
      return fileStore.storeStats();
    }
  }
  return fileStore.storeStats();
}

export function storeDriver(): "postgres" | "file" {
  return isPostgres() ? "postgres" : "file";
}
