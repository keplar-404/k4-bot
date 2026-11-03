import type { Env } from "../../config/env";
import { sendEmail } from "../../shared/mail";

type User = { id: string; email: string };

/** Email + password sign-in, with a reset link by email. */
export const emailAndPassword = (env: Env) => ({
  enabled: true,
  requireEmailVerification: true,
  minPasswordLength: 12,
  revokeSessionsOnPasswordReset: true,
  sendResetPassword: async ({ user, url }: { user: User; url: string }) => {
    await sendEmail(env, user.email, "Reset your K4 Bot password", `Click the link to reset your password: ${url}`);
  },
});

/** Verification on sign-up. `afterVerified` runs once the address is confirmed. */
export const emailVerification = (env: Env, afterVerified: (userId: string) => Promise<void>) => ({
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  // Not on sign-up: an unverified (possibly fake) account must not cost a computer.
  afterEmailVerification: async (user: User) => afterVerified(user.id),
  sendVerificationEmail: async ({ user, url }: { user: User; url: string }) => {
    await sendEmail(env, user.email, "Verify your K4 Bot email", `Click the link to verify your email: ${url}`);
  },
});
