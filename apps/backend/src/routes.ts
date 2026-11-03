import { Hono } from "hono";
import authRoutes from "./modules/auth/routes";
import bots from "./modules/bots/routes";
import chat from "./modules/chat/routes";
import computer from "./modules/computer/routes";
import files from "./modules/files/routes";
import integrations from "./modules/integrations/routes";
import models from "./modules/agent/routes";

import type { Env } from "./config/env";

const routes = new Hono<{ Bindings: Env }>()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", authRoutes)
  .route("/bots", bots)
  .route("/chat", chat)
  .route("/computer", computer)
  .route("/files", files)
  .route("/integrations", integrations)
  .route("/models", models);

export default routes;
