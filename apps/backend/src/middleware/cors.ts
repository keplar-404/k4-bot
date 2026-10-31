import { cors } from "hono/cors";
import type { Env } from "../lib/env";

export const corsMiddleware = cors({
  origin: (origin, c) => {
    const allowed = [c.env.WEB_ORIGIN, c.env.BETTER_AUTH_URL].filter(
      (v): v is string => Boolean(v),
    );
    return origin && allowed.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
