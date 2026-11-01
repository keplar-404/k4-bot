import { Hono } from "hono";
import health from "./health";
import authRoutes from "./auth";
import bots from "./bots";
import chat from "./chat";
import models from "./models";

import type { Env } from "../lib/env";

const routes = new Hono<{ Bindings: Env }>()
  .route("/health", health)
  .route("/auth", authRoutes)
  .route("/bots", bots)
  .route("/chat", chat)
  .route("/models", models);

export default routes;