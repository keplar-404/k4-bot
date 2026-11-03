import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { safeCallback } from "@/features/auth/auth-redirect";

const API = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

/**
 * Asks the API whether the session cookie is still valid (expired, revoked or signed out elsewhere
 * leaves the cookie in the browser). Better Auth's documented check for a separate auth server:
 * `GET /get-session` with the request's cookies. `null` means the API could not be reached: the
 * page then loads and its own session check decides, instead of a sign-in loop while the API is down.
 * https://better-auth.com/docs/integrations/next#auth-protection
 */
async function sessionIsValid(request: NextRequest): Promise<boolean | null> {
  try {
    const res = await fetch(`${API}/api/v1/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { session?: unknown } | null;
    return Boolean(body?.session);
  } catch {
    return null;
  }
}

const isAuthPage = (path: string) => path === "/sign-in" || path === "/sign-up";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasCookie = Boolean(getSessionCookie(request));

  if (isAuthPage(pathname)) {
    // Already signed in: skip the form and go where they were headed.
    if (hasCookie && (await sessionIsValid(request)) === true) {
      const target = safeCallback(
        request.nextUrl.searchParams.get("callbackUrl"),
      );
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // Link prefetches only look at the cookie: validating each one would call the API for every link.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  const valid = !hasCookie
    ? false
    : isPrefetch
      ? true
      : await sessionIsValid(request);
  if (valid !== false) return NextResponse.next();

  const url = new URL("/sign-in", request.url);
  url.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
