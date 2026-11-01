import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Optimistic redirect only: it checks that a session cookie exists, not that it
 * is valid. Every API route re-validates the session; this just keeps signed-out
 * visitors off the dashboard shell. `getSessionCookie` knows the cookie prefix
 * Better Auth uses on https (`__Secure-`), which a hard-coded name misses.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
