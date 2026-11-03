"use client";

import { useEffect } from "react";
import { useMessageScroller } from "@/components/ui/message-scroller";
import type { ChatMessageView } from "@/features/chat/lib/protocol";

/** Sending a message jumps to the bottom; the scroller's auto-follow then keeps the newest part in view. */
export function ScrollToEndOnSend({
  lastMessage,
}: {
  lastMessage?: ChatMessageView;
}) {
  const { scrollToEnd } = useMessageScroller();
  const id = lastMessage?.role === "user" ? lastMessage.id : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new user message triggers it
  useEffect(() => {
    if (id) scrollToEnd({ behavior: "auto" });
  }, [id]);
  return null;
}
