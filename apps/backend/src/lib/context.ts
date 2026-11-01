import { createAuth } from "./auth";
import { createDb, type Db } from "../db";
import { parseEnv, type Env } from "./env";

type Auth = ReturnType<typeof createAuth>;

export type RequestContext = { env: Env; auth: Auth; db: Db };

type HonoLikeContext = {
  env: Env;
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void };
  req: { raw: Request };
};

// Better Auth gets this request's waitUntil, so it is built per request (the
// documented Workers pattern) and memoised so one request builds it once.
// The db handle is stateless over HTTP and safe to share.
const perRequest = new WeakMap<Request, RequestContext>();
const dbs = new Map<string, Db>();

export function getRequestContext(c: HonoLikeContext): RequestContext {
  const hit = perRequest.get(c.req.raw);
  if (hit) return hit;

  const env = parseEnv(c.env);
  let db = dbs.get(env.DATABASE_URL);
  if (!db) dbs.set(env.DATABASE_URL, (db = createDb(env.DATABASE_URL)));

  const ctx = {
    env,
    db,
    auth: createAuth(env, (promise) => c.executionCtx.waitUntil(promise)),
  };
  perRequest.set(c.req.raw, ctx);
  return ctx;
}
