import { Hono } from "hono";
import authRoutes from "./modules/auth/routes";
import bots from "./modules/bots/routes";
import chat from "./modules/chat/routes";
import computer from "./modules/computer/routes";
import files from "./modules/files/routes";
import integrations from "./modules/integrations/routes";
import sandbox from "./modules/sandbox/routes";
import sandboxEditor from "./modules/sandbox/editor-routes";
import models from "./modules/agent/routes";
import memory from "./modules/memory/routes";

import type { Env } from "./config/env";

const routes = new Hono<{ Bindings: Env }>()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", authRoutes)
  .route("/bots", bots)
  .route("/chat", chat)
  .route("/computer", computer)
  .route("/files", files)
  .route("/integrations", integrations)
  // The editor first: its token-gated socket must answer before the main routes' sign-in check.
  .route("/sandbox", sandboxEditor)
  .route("/sandbox", sandbox)
  .route("/models", models)
  .route("/memory", memory);

export default routes;
