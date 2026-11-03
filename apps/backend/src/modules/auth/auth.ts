import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { computerFor } from "../computer/sandbox-backend";
import { createDb } from "../../db";
import type { Env } from "../../config/env";
import { emailAndPassword, emailVerification } from "./email";
import { rateLimit, session } from "./limits";

export function createAuth(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = () => {},
) {
  const db = createDb(env.DATABASE_URL);
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  // Bindings exist only inside the Worker (not in the CLI config that reuses this function).
  const hasComputer = Boolean(env.USER_COMPUTER);

  /** A verified user gets their own fresh computer. Only schedules it: the request never waits on E2B. */
  const provisionComputer = async (userId: string) => {
    if (!hasComputer) return;
    await computerFor(env, userId)
      .provision()
      .catch((e: unknown) => console.error("[auth] computer provisioning not scheduled", e));
  };

  return betterAuth({
    appName: "K4 Bot",
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    trustedOrigins: [env.BETTER_AUTH_URL, env.WEB_ORIGIN].filter(
      (v): v is string => Boolean(v),
    ),
    emailAndPassword: emailAndPassword(env),
    emailVerification: emailVerification(env, provisionComputer),
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {},
    session,
    rateLimit,
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
            // Google sign-ups arrive already verified, so they never pass afterEmailVerification.
            if (user.emailVerified) await provisionComputer(user.id);
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;
export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
