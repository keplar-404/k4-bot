import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../../db";
import type { Env } from "../env";

export function createAuth(env: Env) {
  const db = createDb(env.DATABASE_URL);
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return betterAuth({
    appName: "K4 Bot",
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    trustedOrigins: [env.BETTER_AUTH_URL, env.WEB_ORIGIN].filter(
      (v): v is string => Boolean(v),
    ),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        // Stub: wire a real email provider (Resend/Cloudflare Email) in production.
        console.log("[auth] password reset for", user.email, url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        console.log("[auth] verify email for", user.email, url);
      },
    },
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {},
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
    },
    account: {
      storeStateStrategy: "cookie",
    },
    advanced: {
      useSecureCookies: env.BETTER_AUTH_URL.startsWith("https"),
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            console.log("[auth] user created", user.id, user.email);
          },
        },
      },
    },
  });
}