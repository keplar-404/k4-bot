import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Better Auth Next.js docs: optimistic cookie check only; the backend and the
// agent validate the session. getSessionCookie also finds the __Secure- cookie.
export function proxy(request: NextRequest) {
	if (!getSessionCookie(request)) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
