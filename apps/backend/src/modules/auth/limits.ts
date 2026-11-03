/** Sessions last a week, refreshed daily; the cookie cache saves a database read for 5 minutes. */
export const session = {
  expiresIn: 60 * 60 * 24 * 7,
  updateAge: 60 * 60 * 24,
  freshAge: 60 * 60,
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60,
    strategy: "compact" as const,
  },
};

/** Better Auth's own limiter (database-backed), tighter on the endpoints worth brute-forcing. */
export const rateLimit = {
  enabled: true,
  window: 60,
  max: 100,
  storage: "database" as const,
  customRules: {
    "/api/v1/auth/sign-in/email": { window: 60, max: 5 },
    "/api/v1/auth/sign-up/email": { window: 60, max: 3 },
    "/api/v1/auth/forget-password": { window: 60, max: 3 },
  },
};
