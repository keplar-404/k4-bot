import { Hono } from "hono";
import { createAuth } from "../lib/auth";
import { parseEnv } from "../lib/env";
import type { Env } from "../lib/env";

const authRoutes = new Hono<{ Bindings: Env }>().on(
  ["GET", "POST"],
  "/*",
  (c) => {
    const auth = createAuth(parseEnv(c.env));
    return auth.handler(c.req.raw);
  },
);

export default authRoutes;