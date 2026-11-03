import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { DEFAULT_MODEL_ID, models } from "../agent/models";

const modelsRoute = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  // The catalog only changes with a deploy: the browser may reuse it for an hour without asking the Worker.
  // `private` because the route is behind sign-in, so no shared cache (CDN) may keep it.
  .get("/", (c) =>
    c.json({ models, defaultModel: DEFAULT_MODEL_ID }, 200, { "Cache-Control": "private, max-age=3600" }),
  );

export default modelsRoute;
