"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { fetchBot } from "@/features/bots/api";

export function useChatEffects(
  botId: string,
  connection: string,
  error: { kind: string; message: string; retryable?: boolean } | null,
  dismissError: () => void,
) {
  const router = useRouter();

  useEffect(() => {
    void fetchBot(botId).then((res) => {
      if (!res.ok) router.replace("/dashboard");
    });
  }, [botId, router]);

  // ONE toast, keyed by a single id, so losing the socket never shows two.
  useEffect(() => {
    if (connection === "offline") {
      toast.warning("You're offline", {
        id: "connection",
        description: "Messages will send when you're back.",
        duration: Number.POSITIVE_INFINITY,
      });
      return;
    }
    if (connection === "open" || connection === "idle") {
      toast.dismiss("connection");
    }
  }, [connection]);

  useEffect(() => {
    if (!error) return;
    // A network error is the same event as "offline": the connection toast
    // says it once. Only real server/model errors get their own toast.
    if (error.kind !== "network") {
      toast.error(error.message, {
        id: "chat-error",
        description: error.retryable
          ? "Retry from the message above."
          : undefined,
      });
    }
    dismissError();
  }, [error, dismissError]);
}
