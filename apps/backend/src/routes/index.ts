import { Hono } from "hono";
import health from "./health";
import authRoutes from "./auth";

import type { Env } from "../lib/env";

const routes = new Hono<{ Bindings: Env }>()
  .route("/health", health)
  .route("/auth", authRoutes);

export default routes;