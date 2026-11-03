import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { computerFor } from "../../computer/sandbox-backend";
import { createDb } from "../../db";
import { chatThread } from "../../db/schema";
import { cleanupThreads } from "../cleanup";
import { sendEmail } from "../mail";
import type { Env } from "../env";

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
      // Not on sign-up: an unverified (possibly fake) account must not cost a computer.
      afterEmailVerification: async (user) => provisionComputer(user.id),
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
            // Google sign-ups arrive already verified, so they never pass afterEmailVerification.
            if (user.emailVerified) await provisionComputer(user.id);
          },
        },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Every deletion is confirmed from the account's inbox: it is irreversible, and it is the only
        // proof of intent for Google users, who have no password.
        sendDeleteAccountVerification: async ({ user, url }) => {
          await sendEmail(
            env,
            user.email,
            "Confirm deleting your K4 Bot account",
            `Click the link to permanently delete your account, all your bots, their chats and your computer: ${url}\n\nIf you did not ask for this, ignore this email.`,
          );
        },
        // Runs on both deletion paths, before the user row goes (cascading bots, threads, messages,
        // events and usage). Here: stop the runs, delete agent memory, destroy the computer.
        beforeDelete: async (user) => {
          const threads = await db
            .select({ id: chatThread.id })
            .from(chatThread)
            .where(eq(chatThread.userId, user.id));
          await cleanupThreads(db, env, threads.map((t) => t.id));
          if (hasComputer) {
            await computerFor(env, user.id)
              .deleteAll()
              .catch((e: unknown) => console.error("[auth] computer not destroyed", user.id, e));
          }
          console.log(JSON.stringify({ event: "user.deleted", userId: user.id }));
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;
export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
