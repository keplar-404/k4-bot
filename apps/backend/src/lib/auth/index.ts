import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../../db";
import { sendEmail } from "../mail";
import type { Env } from "../env";

export function createAuth(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = () => {},
) {
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
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(
          env,
          user.email,
          "Reset your K4 Bot password",
          `Click the link to reset your password: ${url}`,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(
          env,
          user.email,
          "Verify your K4 Bot email",
          `Click the link to verify your email: ${url}`,
        );
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
      freshAge: 60 * 60,
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
      customRules: {
        "/api/v1/auth/sign-in/email": { window: 60, max: 5 },
        "/api/v1/auth/sign-up/email": { window: 60, max: 3 },
        "/api/v1/auth/forget-password": { window: 60, max: 3 },
      },
    },
    account: {
      storeStateStrategy: "cookie",
      encryptOAuthTokens: true,
    },
    advanced: {
      useSecureCookies: env.BETTER_AUTH_URL.startsWith("https"),
      // Web and API on sibling subdomains: share the session cookie across them.
      ...(env.COOKIE_DOMAIN
        ? { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } }
        : {}),
      backgroundTasks: {
        handler: (promise) => waitUntil(promise),
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            console.log(
              JSON.stringify({ event: "user.created", userId: user.id }),
            );
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;
export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
