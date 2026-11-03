"use client";

import { Loader2Icon, WifiOffIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { redirectToSignIn } from "@/lib/auth-redirect";

/**
 * The dashboard's own session check, behind the proxy's: it catches a session that ends while the
 * page is open (expired, signed out in another tab) and a server that cannot be reached, which
 * would otherwise leave the page as "Guest" with endless loading placeholders.
 */
export function AuthGuard() {
  const { data, isPending, error, refetch } = useSession();
  const signedOut = !isPending && !error && !data;

  useEffect(() => {
    if (signedOut) redirectToSignIn();
  }, [signedOut]);

  if (signedOut) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Taking you to sign in…
        </span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        role="alert"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b bg-background/95 px-4 py-2 text-sm backdrop-blur"
      >
        <WifiOffIcon className="size-4 shrink-0 text-muted-foreground" />
        <span>Can't reach the server. Check your connection.</span>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return null;
}
