import { Hono } from "hono";
import health from "./health";
import authRoutes from "./auth";

const routes = new Hono<{ Bindings: CloudflareBindings }>();

routes.route("/health", health);
routes.route("/auth", authRoutes);

export default routes;