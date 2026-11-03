import { Hono } from "hono";
import health from "./health";
import authRoutes from "./auth";
import bots from "./bots";
import chat from "./chat";
import computer from "./computer";
import files from "./files";
import integrations from "./integrations";
import models from "./models";

import type { Env } from "../lib/env";

const routes = new Hono<{ Bindings: Env }>()
  .route("/health", health)
  .route("/auth", authRoutes)
  .route("/bots", bots)
  .route("/chat", chat)
  .route("/computer", computer)
  .route("/files", files)
  .route("/integrations", integrations)
  .route("/models", models);

export default routes;