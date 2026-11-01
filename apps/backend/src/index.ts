// The web app imports `AppType` from this file, so its type-check also reads the
// Worker's ambient types (Durable Objects, Workflows, `cloudflare:workers`).
/// <reference types="../worker-configuration" />
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { corsMiddleware } from "./middleware/cors";
import { ipLimit } from "./middleware/rate-limit";
import routes from "./routes";
import { scheduled } from "./scheduled";
import type { Env } from "./lib/env";

// Wrangler resolves the Durable Object and Workflow bindings from these exports.
export { ChatRelayDurableObject } from "./durable/chat-relay";
export { ChatRunWorkflow } from "./workflows/chat-run";

const app = new Hono<{ Bindings: Env }>()
  .use("*", corsMiddleware)
  .use("*", secureHeaders())
  .use("*", bodyLimit({ maxSize: 1024 * 1024 }))
  // /auth/* is rate limited by Better Auth itself (database-backed rules).
  .use("/api/v1/*", (c, next) =>
    c.req.path.startsWith("/api/v1/auth/") ? next() : ipLimit(c, next),
  )
  .route("/api/v1", routes);

export type AppType = typeof app;

// fetch serves the API; scheduled runs the daily cleanup (wrangler.jsonc triggers).
export default { fetch: app.fetch, scheduled };
