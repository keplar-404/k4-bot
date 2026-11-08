import type { Composio } from "@composio/core";
import { lt, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { composioToolkit } from "../../db/schema";
import { type RawToolkit, rawClient } from "./client";

/** The catalog changes slowly (new apps, new tool counts): a day old is fresh enough. */
export const CATALOG_MAX_AGE_MS = 24 * 60 * 60_000;
const PAGE = 1000;
const MAX_PAGES = 10;

const toRow = (t: RawToolkit, rank: number) => ({
  slug: t.slug,
  name: t.name,
  description: (t.meta?.description ?? "").slice(0, 600),
  logo: t.meta?.logo ?? null,
  categories: (t.meta?.categories ?? []).map((c) => ({ slug: c.id, name: c.name })),
  toolsCount: t.meta?.tools_count ?? 0,
  triggersCount: t.meta?.triggers_count ?? 0,
  noAuth: Boolean(t.no_auth),
  rank,
  syncedAt: new Date(),
});

/**
 * Copies Composio's whole toolkit catalog into composio_toolkit (2 API calls for ~1,700 apps), in popularity order,
 * then removes apps Composio no longer lists. Returns how many apps it saved.
 */
export async function syncCatalog(db: Db, composio: Composio): Promise<number> {
  const started = new Date();
  const all: RawToolkit[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await rawClient(composio).toolkits.list({ limit: PAGE, sort_by: "usage", cursor });
    all.push(...res.items.filter((t) => t.slug && t.name));
    cursor = res.next_cursor ?? undefined;
    if (!cursor) break;
  }
  if (all.length === 0) return 0; // never wipe the catalog because of an empty answer
  const rows = all.map(toRow);
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(composioToolkit)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: composioToolkit.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          logo: sql`excluded.logo`,
          categories: sql`excluded.categories`,
          toolsCount: sql`excluded.tools_count`,
          triggersCount: sql`excluded.triggers_count`,
          noAuth: sql`excluded.no_auth`,
          rank: sql`excluded.rank`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  await db.delete(composioToolkit).where(lt(composioToolkit.syncedAt, started));
  return rows.length;
}

/** When the catalog was last synced (null when it never was). */
export async function catalogAge(db: Db): Promise<number | null> {
  // Computed by Postgres in UTC: a timestamp read back as a JS Date would be taken as local time.
  const [row] = await db
    .select({
      ms: sql<number | null>`extract(epoch from (now() at time zone 'utc' - max(${composioToolkit.syncedAt}))) * 1000`,
    })
    .from(composioToolkit);
  return row?.ms == null ? null : Number(row.ms);
}
