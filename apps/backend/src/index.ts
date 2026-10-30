import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import routes from "./routes";
import type { Env } from "./lib/env";

const app = new Hono<{ Bindings: Env }>()
  .use("*", corsMiddleware)
  .use("*", secureHeaders())
  .use("*", bodyLimit({ maxSize: 1024 * 1024 }))
  .route("/api/v1", routes);

export type AppType = typeof app;

export default app;