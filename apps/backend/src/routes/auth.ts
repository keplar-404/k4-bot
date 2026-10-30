import { Hono } from "hono";
import { createAuth } from "../lib/auth";

const authRoutes = new Hono<{ Bindings: CloudflareBindings }>();

authRoutes.on(["GET", "POST"], "/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

export default authRoutes;