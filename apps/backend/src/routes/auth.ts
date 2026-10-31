import { Hono } from "hono";
import { getRequestContext } from "../lib/context";
import type { Env } from "../lib/env";

const authRoutes = new Hono<{ Bindings: Env }>().on(
  ["GET", "POST"],
  "/*",
  (c) => {
    const { auth } = getRequestContext(c);
    return auth.handler(c.req.raw);
  },
);

export default authRoutes;