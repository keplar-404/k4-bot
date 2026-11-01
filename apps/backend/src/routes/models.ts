import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { DEFAULT_MODEL_ID, models } from "../agent/models";

const modelsRoute = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", (c) => c.json({ models, defaultModel: DEFAULT_MODEL_ID }));

export default modelsRoute;
