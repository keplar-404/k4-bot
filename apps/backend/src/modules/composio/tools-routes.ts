import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../middleware/auth-guard";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { isKnownToolkit } from "./catalog-query";
import { composioFor, TOOLKIT_SLUG } from "./client";
import { composioError } from "./errors";
import { getTool, listTools } from "./tools";

const TOOL_SLUG = /^[A-Z0-9_]{1,120}$/;

/** What the workflow builder needs from an app: its actions, and one action's input form. Read-only and cached. */
const toolsRoutes = new Hono<AuthGuardEnv>()
  .get(
    "/toolkits/:toolkit/tools",
    validate("param", z.object({ toolkit: z.string().regex(TOOLKIT_SLUG) })),
    async (c) => {
      const { db, env } = getRequestContext(c);
      const { toolkit } = c.req.valid("param");
      try {
        if (!(await isKnownToolkit(db, toolkit))) return c.json({ error: "NOT_FOUND", message: "Unknown app." }, 404);
        c.header("Cache-Control", "private, max-age=600");
        return c.json({ items: await listTools(composioFor(env), toolkit) });
      } catch (error) {
        return composioError(c, error, "load this app's actions");
      }
    },
  )
  .get("/tools/:slug", validate("param", z.object({ slug: z.string().regex(TOOL_SLUG) })), async (c) => {
    const { env } = getRequestContext(c);
    try {
      c.header("Cache-Control", "private, max-age=600");
      return c.json(await getTool(composioFor(env), c.req.valid("param").slug));
    } catch (error) {
      return composioError(c, error, "load this action");
    }
  });

export default toolsRoutes;
