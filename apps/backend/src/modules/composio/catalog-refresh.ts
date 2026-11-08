import type { Db } from "../../db";
import type { Env } from "../../config/env";
import { CATALOG_MAX_AGE_MS, catalogAge, syncCatalog } from "./catalog-sync";
import { composioFor } from "./client";

/** At most one sync in flight per isolate: a burst of page views never multiplies Composio calls. */
let inFlight: Promise<number> | null = null;

function syncOnce(db: Db, env: Env): Promise<number> {
  inFlight ??= syncCatalog(db, composioFor(env)).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * The catalog is ready to read. The first ever view fills it (one wait of ~2 s); afterwards a stale catalog is
 * refreshed in the background (the request reads the current copy at once). The daily cron also refreshes it.
 */
export async function ensureCatalog(c: { executionCtx: { waitUntil(p: Promise<unknown>): void } }, db: Db, env: Env) {
  composioFor(env); // throws ComposioNotConfigured before any work when the key is missing
  const age = await catalogAge(db);
  if (age === null) {
    await syncOnce(db, env);
    return;
  }
  if (age > CATALOG_MAX_AGE_MS)
    c.executionCtx.waitUntil(syncOnce(db, env).catch((e) => console.error("[composio] catalog refresh failed", e)));
}

/** For the cron: refresh when the key is set; never throws. */
export async function refreshCatalog(db: Db, env: Env) {
  if (!env.COMPOSIO_API_KEY) return;
  const n = await syncOnce(db, env).catch((e) => (console.error("[composio] catalog refresh failed", e), 0));
  console.log(`[composio] catalog synced: ${n} apps`);
}
