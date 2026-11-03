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
import type { Env } from "./config/env";

// Wrangler resolves the Durable Object and Workflow bindings from these exports.
export { ChatRelayDurableObject } from "./modules/chat/relay";
export { ChatRunWorkflow } from "./modules/chat/run/workflow";
export { UserComputerDurableObject } from "./modules/computer/user-computer";

// The live view of the computer: token-gated, framed by the web app, and ~60 asset requests per page load.
// Stored images are shown by the web app (another origin) in <img>: the default same-origin policy would block them.
const isFileBytes = (path: string) => /^\/api\/v1\/files\/[^/]+\/content$/.test(path);
const isStream = (path: string) => path.startsWith("/api/v1/computer/stream/");

const app = new Hono<{ Bindings: Env }>()
  .use("*", corsMiddleware)
  // The stream route sets its own framing headers (secureHeaders would forbid the iframe).
  .use("*", (c, next) => (isStream(c.req.path) ? next() : secureHeaders(isFileBytes(c.req.path) ? { crossOriginResourcePolicy: "cross-origin" } : undefined)(c, next)))
  .use("*", bodyLimit({ maxSize: 1024 * 1024 }))
  // /auth/* is rate limited by Better Auth itself (database-backed rules).
  .use("/api/v1/*", (c, next) =>
    c.req.path.startsWith("/api/v1/auth/") || isStream(c.req.path) ? next() : ipLimit(c, next),
  )
  .route("/api/v1", routes);

export type AppType = typeof app;

// fetch serves the API; scheduled runs the daily cleanup (wrangler.jsonc triggers).
export default { fetch: app.fetch, scheduled };
