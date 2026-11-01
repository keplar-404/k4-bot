import { createMiddleware } from "hono/factory";
import type { Context, Env as HonoEnv } from "hono";
import type { Env } from "../lib/env";
import type { AuthGuardEnv } from "./auth-guard";

const warned = new Set<string>();

/**
 * Cloudflare's native Rate Limiting binding (see `ratelimits` in
 * wrangler.jsonc): no database round trips, counters live at the edge.
 */
const limiter = <E extends HonoEnv & { Bindings: Env }>(
  binding: "RL" | "RL_WRITE",
  keyOf: (c: Context<E>) => string,
) =>
  createMiddleware<E>(async (c, next) => {
    // A limiter outage must not take the API down: log it and let the request through.
    const outcome = await c.env[binding].limit({ key: keyOf(c) }).catch((error: unknown) => {
      if (!warned.has(binding)) {
        warned.add(binding);
        console.error(`[rate-limit] ${binding} unavailable, allowing requests`, error);
      }
      return { success: true };
    });
    if (!outcome.success) {
      return c.json({ error: "RATE_LIMITED", message: "Too many requests." }, 429, {
        "Retry-After": "60",
      });
    }
    await next();
  });

/** Every API request, per client IP. */
export const ipLimit = limiter<{ Bindings: Env }>(
  "RL",
  (c) => c.req.header("cf-connecting-ip") ?? "unknown",
);

/** Mutating and expensive routes, per signed-in user. Mount after authGuard. */
export const userLimit = limiter<AuthGuardEnv>(
  "RL_WRITE",
  (c) => c.get("session").user.id,
);
