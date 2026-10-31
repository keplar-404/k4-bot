import { createMiddleware } from "hono/factory";
import { getRequestContext } from "../lib/context";
import type { Env } from "../lib/env";
import type { Session } from "../lib/auth";

export type AuthGuardEnv = {
  Bindings: Env;
  Variables: { session: Session };
};

export const authGuard = createMiddleware<AuthGuardEnv>(async (c, next) => {
  const { auth } = getRequestContext(c);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Authentication required" },
      401,
    );
  }
  c.set("session", session);
  await next();
});
