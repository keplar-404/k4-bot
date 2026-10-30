import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "./db";

export function createAuth(env: {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}) {
  const db = createDb(env.DATABASE_URL);
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    emailAndPassword: { enabled: true },
  });
}