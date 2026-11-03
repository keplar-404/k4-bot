import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { contextLengthOf } from "./model-context";
import { DEFAULT_MODEL_ID, models } from "./models";

const modelsRoute = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  // Each model's context window is OpenRouter's live value, so the chat's context meter is right for every model.
  // `private` because the route is behind sign-in, so no shared cache (CDN) may keep it.
  .get("/", async (c) => {
    const withContext = await Promise.all(models.map(async (m) => ({ ...m, contextLength: await contextLengthOf(m.id) })));
    return c.json({ models: withContext, defaultModel: DEFAULT_MODEL_ID }, 200, { "Cache-Control": "private, max-age=3600" });
  });

export default modelsRoute;
