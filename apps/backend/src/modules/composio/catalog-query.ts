import { and, asc, count, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db";
import { composioToolkit } from "../../db/schema";

export type CatalogQuery = {
  q?: string;
  category?: string;
  slugs?: string[];
  withTriggers?: boolean;
  /** Only apps that need no account (nothing to connect). */
  noAuth?: boolean;
  offset: number;
  limit: number;
};

/** `%` and `_` typed by the user are literal characters, not wildcards. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

function where(q: CatalogQuery): SQL | undefined {
  const parts: SQL[] = [];
  const text = q.q?.trim();
  if (text) {
    const p = like(text);
    parts.push(
      or(ilike(composioToolkit.name, p), ilike(composioToolkit.slug, p), ilike(composioToolkit.description, p))!,
    );
  }
  // jsonb containment: the toolkit lists this category among its own.
  if (q.category) parts.push(sql`${composioToolkit.categories} @> ${JSON.stringify([{ slug: q.category }])}::jsonb`);
  if (q.noAuth) parts.push(sql`${composioToolkit.noAuth} = true`);
  if (q.withTriggers) parts.push(sql`${composioToolkit.triggersCount} > 0`);
  if (q.slugs) parts.push(q.slugs.length ? inArray(composioToolkit.slug, q.slugs) : sql`false`);
  return parts.length ? and(...parts) : undefined;
}

/** One page of the catalog in popularity order, plus how many apps match in total. */
export async function searchCatalog(db: Db, q: CatalogQuery) {
  const filter = where(q);
  const [items, [total]] = await Promise.all([
    db.select().from(composioToolkit).where(filter).orderBy(asc(composioToolkit.rank)).limit(q.limit).offset(q.offset),
    db.select({ n: count() }).from(composioToolkit).where(filter),
  ]);
  return {
    items: items.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      logo: t.logo,
      categories: t.categories,
      toolsCount: t.toolsCount,
      triggersCount: t.triggersCount,
      noAuth: t.noAuth,
    })),
    total: total?.n ?? 0,
  };
}

/** Every category with how many apps it has, largest first (built from the toolkits, not Composio's raw list). */
export async function catalogCategories(db: Db): Promise<Array<{ slug: string; name: string; count: number }>> {
  const result = await db.execute(sql`
    SELECT c->>'slug' AS slug, min(c->>'name') AS name, count(*)::int AS count
    FROM composio_toolkit, jsonb_array_elements(categories) AS c
    GROUP BY c->>'slug' ORDER BY count(*) DESC, min(c->>'name')`);
  return result.rows as Array<{ slug: string; name: string; count: number }>;
}

/** Whether a slug is a real app in the catalog (connect requests for anything else are refused). */
export async function isKnownToolkit(db: Db, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(composioToolkit)
    .where(inArray(composioToolkit.slug, [slug]));
  return (row?.n ?? 0) > 0;
}

/** Apps that need no login (Composio's own utility tools, for example): there is nothing to connect. */
export async function isNoAuthToolkit(db: Db, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ noAuth: composioToolkit.noAuth })
    .from(composioToolkit)
    .where(inArray(composioToolkit.slug, [slug]));
  return Boolean(row?.noAuth);
}

/** Sign-in methods where the user holds a key, token or password: what a saved secret can be used for. */
export const KEY_SCHEMES = ["API_KEY", "BEARER_TOKEN", "BASIC", "BASIC_WITH_JWT", "GOOGLE_SERVICE_ACCOUNT", "SERVICE_ACCOUNT"];

/** Apps a secret can be for (they sign in with a key or token), searched by name, most used first. */
export async function secretApps(db: Db, q: string | undefined, limit: number) {
  const text = q?.trim();
  return db
    .select({ slug: composioToolkit.slug, name: composioToolkit.name, logo: composioToolkit.logo })
    .from(composioToolkit)
    .where(
      and(
        sql`${composioToolkit.authSchemes} ?| ${sql.raw(`array[${KEY_SCHEMES.map((k) => `'${k}'`).join(",")}]`)}`,
        text ? or(ilike(composioToolkit.name, like(text)), ilike(composioToolkit.slug, like(text))) : undefined,
      ),
    )
    .orderBy(asc(composioToolkit.rank))
    .limit(limit);
}
