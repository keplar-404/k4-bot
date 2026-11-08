import { createMiddleware } from "hono/factory";
import type { Context, Env as HonoEnv } from "hono";
import type { Env } from "../config/env";
import type { AuthGuardEnv } from "./auth-guard";

type Binding = "RL" | "RL_WRITE" | "RL_WF_SAVE" | "RL_WF_RUN" | "RL_WF_HOOK" | "RL_APP_EXEC" | "RL_HTTP";
const warned = new Set<string>();

/**
 * Cloudflare's native Rate Limiting binding (see `ratelimits` in wrangler.jsonc): no database round trips,
 * counters live at the edge. A limiter outage must not take the API down: it is logged and the call is allowed.
 * Also used outside routes (bot tools, the workflow engine), where there is no request to answer with a 429.
 */
export async function allow(env: Pick<Env, Binding>, binding: Binding, key: string): Promise<boolean> {
  const outcome = await env[binding].limit({ key }).catch((error: unknown) => {
    if (!warned.has(binding)) {
      warned.add(binding);
      console.error(`[rate-limit] ${binding} unavailable, allowing requests`, error);
    }
    return { success: true };
  });
  return outcome.success;
}

const limiter = <E extends HonoEnv & { Bindings: Env }>(binding: Binding, keyOf: (c: Context<E>) => string) =>
  createMiddleware<E>(async (c, next) => {
    if (!(await allow(c.env, binding, keyOf(c)))) {
      return c.json({ error: "RATE_LIMITED", message: "Too many requests." }, 429, { "Retry-After": "60" });
    }
    await next();
  });

/** Every API request, per client IP. */
export const ipLimit = limiter<{ Bindings: Env }>("RL", (c) => c.req.header("cf-connecting-ip") ?? "unknown");

/** Workflow autosave (60/min) and workflow runs (10/min), per signed-in user. Mount after authGuard. */
export const workflowSaveLimit = limiter<AuthGuardEnv>("RL_WF_SAVE", (c) => c.get("session").user.id);
export const workflowRunLimit = limiter<AuthGuardEnv>("RL_WF_RUN", (c) => c.get("session").user.id);

/** Public webhook calls: 60/min per workflow, whoever calls (the URL is the credential, so it is the key). */
export const workflowHookLimit = limiter<{ Bindings: Env }>("RL_WF_HOOK", (c) => `hook:${c.req.param("id")}`);

/** Mutating and expensive routes, per signed-in user. Mount after authGuard. */
export const userLimit = limiter<AuthGuardEnv>("RL_WRITE", (c) => c.get("session").user.id);
