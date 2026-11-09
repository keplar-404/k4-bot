import { Hono } from "hono";
import authRoutes from "./modules/auth/routes";
import bots from "./modules/bots/routes";
import chat from "./modules/chat/routes";
import computer from "./modules/computer/routes";
import files from "./modules/files/routes";
import integrations from "./modules/integrations/routes";
import composio from "./modules/composio/routes";
import composioEvents from "./modules/composio/events-route";
import workflows from "./modules/workflows/routes";
import sandbox from "./modules/sandbox/routes";
import sandboxEditor from "./modules/sandbox/editor-routes";
import models from "./modules/agent/routes";
import memory from "./modules/memory/routes";
import secrets from "./modules/secrets/routes";
import tasks from "./modules/tasks/routes";
import hooks from "./modules/workflows/routes/hooks";

import type { Env } from "./config/env";

const routes = new Hono<{ Bindings: Env }>()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", authRoutes)
  .route("/bots", bots)
  .route("/chat", chat)
  .route("/computer", computer)
  .route("/files", files)
  .route("/integrations", integrations)
  // Signed by Composio, no session: before the Composio routes and their sign-in check.
  .route("/composio/events", composioEvents)
  .route("/composio", composio)
  .route("/workflows", workflows)
  // The editor first: its token-gated socket must answer before the main routes' sign-in check.
  .route("/sandbox", sandboxEditor)
  .route("/sandbox", sandbox)
  .route("/models", models)
  .route("/memory", memory)
  .route("/secrets", secrets)
  .route("/tasks", tasks)
  .route("/hooks", hooks);

export default routes;
