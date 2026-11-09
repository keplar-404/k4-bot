import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../middleware/auth-guard";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { catalogCategories, searchCatalog } from "./catalog-query";
import { ensureCatalog } from "./catalog-refresh";
import { TOOLKIT_SLUG } from "./client";
import { composioError } from "./errors";

const slug = z.string().regex(TOOLKIT_SLUG);
const catalogQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: slug.optional(),
  /** Only these apps (the "Connected" filter): at most 200. */
  slugs: z.string().max(4000).optional(),
  /** Only apps with events (the App event trigger's picker). */
  withTriggers: z.enum(["1"]).optional(),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** The app catalog, read from our own table (catalog-sync.ts), so browsing costs no Composio calls. */
const catalogRoutes = new Hono<AuthGuardEnv>()
  .get("/catalog", validate("query", catalogQuery), async (c) => {
    const { db, env } = getRequestContext(c);
    const q = c.req.valid("query");
    try {
      await ensureCatalog(c, db, env);
      const slugs = q.slugs
        ?.split(",")
        .filter((s) => TOOLKIT_SLUG.test(s))
        .slice(0, 200);
      return c.json(await searchCatalog(db, { ...q, slugs, withTriggers: q.withTriggers === "1" }));
    } catch (error) {
      return composioError(c, error, "load the app list");
    }
  })

  .get("/categories", async (c) => {
    const { db, env } = getRequestContext(c);
    try {
      await ensureCatalog(c, db, env);
      c.header("Cache-Control", "private, max-age=300");
      return c.json({ items: await catalogCategories(db) });
    } catch (error) {
      return composioError(c, error, "load the categories");
    }
  });

export default catalogRoutes;
