import type { Next } from "hono";
import { getRequestContext } from "../lib/context";
import type { Env } from "../lib/env";
import { apiRateLimit } from "../db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

type Options = {
  window: number; // seconds
  max: number;
};

const DEFAULTS: Options = { window: 60, max: 100 };

type RateLimitContext = {
  env: Env;
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void };
  req: {
    header: (name: string) => string | undefined;
    path: string;
  };
  json: (body: unknown, status?: number) => Response;
};

export function rateLimitMiddleware(options: Partial<Options> = {}) {
  const opts = { ...DEFAULTS, ...options };
  return async (c: RateLimitContext, next: Next) => {
    const { db } = getRequestContext(c);
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for") ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `${c.req.path}:${ip}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - opts.window * 1000);

    const [existing] = await db
      .select()
      .from(apiRateLimit)
      .where(and(eq(apiRateLimit.key, key), gt(apiRateLimit.windowStart, windowStart)))
      .limit(1);

    if (existing && existing.count >= opts.max) {
      return c.json({ error: "Too many requests" }, 429);
    }

    if (existing) {
      await db
        .update(apiRateLimit)
        .set({ count: existing.count + 1 })
        .where(eq(apiRateLimit.id, existing.id));
    } else {
      // Clean up expired rows opportunistically, then start a new window.
      await db.delete(apiRateLimit).where(lt(apiRateLimit.windowStart, windowStart));
      await db.insert(apiRateLimit).values({
        id: crypto.randomUUID(),
        key,
        count: 1,
        windowStart: now,
      });
    }

    await next();
  };
}
