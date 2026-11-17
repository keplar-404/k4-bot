import { auth } from "@/lib/auth/server";

// Neon Auth middleware: signed-out visitors go to /login. /api/auth is public by
// default; /eve is checked by the agent itself (it needs a bearer token, not a redirect).
export default auth.middleware({
	loginUrl: "/login",
	// /monitoring is Sentry's tunnel (next.config.ts): errors on the login page count too.
	publicRoutes: ["/", "/login", "/eve", "/monitoring"],
});

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
