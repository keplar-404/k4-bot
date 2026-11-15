import { createNeonAuth } from "@neon/auth/next/server";

// Managed Better Auth (Neon Auth). This app proxies /api/auth/* to Neon, so the
// session cookie is set on this origin, whatever domain the backend lives on.
export const auth = createNeonAuth({
	baseUrl: process.env.NEON_AUTH_BASE_URL as string,
	cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET as string },
});
