import { type NextRequest, NextResponse } from "next/server";

// Optimistic check only (cookie presence); the backend validates the session.
export function proxy(req: NextRequest) {
	if (!req.cookies.has("better-auth.session_token")) {
		return NextResponse.redirect(new URL("/login", req.url));
	}
}

export const config = { matcher: ["/dashboard/:path*"] };
