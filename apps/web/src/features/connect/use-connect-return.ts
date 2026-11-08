"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Coming back from Composio's Connect Link (`?connected=<app>`): say so, refresh the connections, and clean the URL
 * so a reload does not repeat the message. Composio adds `status=failed` when the user did not finish.
 */
export function useConnectReturn(reload: () => Promise<unknown>) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const app = params.get("connected");
  const failed = params.get("status") === "failed";

  useEffect(() => {
    if (!app) return;
    const name = app.replace(/[_-]+/g, " ");
    if (failed) toast.error(`${name} was not connected. Try again.`);
    else toast.success(`${name} is connected.`);
    void reload();
    router.replace(pathname, { scroll: false });
  }, [app, failed, reload, router, pathname]);
}
