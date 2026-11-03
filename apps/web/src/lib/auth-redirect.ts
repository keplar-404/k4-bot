/**
 * Where to go after signing in. Only same-site paths are accepted ("/dashboard/bot/1"), never an
 * absolute or protocol-relative URL ("//evil.com"), so the sign-in page cannot be used to send a
 * user to another site.
 */
export function safeCallback(raw: string | null | undefined): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\")
  ) {
    return "/dashboard";
  }
  return raw;
}

export function signInPath(from?: string): string {
  return `/sign-in?callbackUrl=${encodeURIComponent(safeCallback(from))}`;
}

let redirecting = false;

/**
 * The session is gone (expired, signed out in another tab, or revoked): leave for the sign-in page and
 * come back here afterwards. A full navigation, so nothing from the old session (caches, sockets)
 * survives. Called once even if several requests fail at the same time.
 */
export function redirectToSignIn(): void {
  if (typeof window === "undefined" || redirecting) return;
  if (window.location.pathname.startsWith("/sign-in")) return;
  redirecting = true;
  window.location.replace(
    signInPath(window.location.pathname + window.location.search),
  );
}
