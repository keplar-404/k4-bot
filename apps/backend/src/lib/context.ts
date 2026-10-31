import type { Context } from "hono";
import { createAuth } from "./auth";
import { createDb, type Db } from "../db";
import { parseEnv, type Env } from "./env";

type Auth = ReturnType<typeof createAuth>;

const authCache = new Map<string, Auth>();
const dbCache = new Map<string, Db>();

function contextKey(env: Env): string {
  return [
    env.DATABASE_URL,
    env.BETTER_AUTH_SECRET,
    env.BETTER_AUTH_URL,
    env.WEB_ORIGIN ?? "",
    env.GOOGLE_CLIENT_ID ?? "",
    env.GOOGLE_CLIENT_SECRET ?? "",
  ].join("|");
}

export type RequestContext = {
  env: Env;
  auth: Auth;
  db: Db;
};

export function getRequestContext(c: {
  env: Env;
  executionCtx: { waitUntil: (promise: Promise<unknown>) => void };
}): RequestContext {
  const env = parseEnv(c.env);
  const key = contextKey(env);

  let auth = authCache.get(key);
  if (!auth) {
    auth = createAuth(env, (promise) => c.executionCtx.waitUntil(promise));
    authCache.set(key, auth);
  }

  let db = dbCache.get(key);
  if (!db) {
    db = createDb(env.DATABASE_URL);
    dbCache.set(key, db);
  }

  return { env, auth, db };
}
