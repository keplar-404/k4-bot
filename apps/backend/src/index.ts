import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import routes from "./routes";
import type { Env } from "./lib/env";

const app = new Hono<{ Bindings: Env }>()
  .use("*", corsMiddleware)
  .use("*", secureHeaders())
  .use("*", bodyLimit({ maxSize: 1024 * 1024 }))
  .use("/api/v1/*", async (c, next) => {
    // /auth/* is rate limited by Better Auth itself (database-backed rules).
    if (c.req.path.startsWith("/api/v1/auth/")) return next();
    return rateLimitMiddleware({ window: 60, max: 100 })(c, next);
  })
  .route("/api/v1", routes);

export type AppType = typeof app;

export default app;