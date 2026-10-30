import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => origin ?? "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});