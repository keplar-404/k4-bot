import type { MessageRow } from "@/features/chat/lib/client";
import type { ChatMessageView } from "@/features/chat/lib/protocol";
import { mergeToolParts, textOfParts } from "@/features/chat/lib/stream";

export function rowsToViews(rows: MessageRow[]): ChatMessageView[] {
  // A group bot's turn is stored before it starts (so the chat counts as busy): an empty one is not shown yet.
  const shown = rows.filter(
    (r) => r.role === "user" || (r.parts ?? []).length > 0,
  );
  return shown.map((r) => {
    const assistant = r.role !== "user";
    const parts = assistant ? mergeToolParts(r.parts ?? []) : (r.parts ?? []);
    const files = parts.flatMap((p) => (p.type === "file" ? [p.file] : []));
    return {
      id: r.id,
      role: assistant ? "assistant" : "user",
      text: textOfParts(parts),
      ...(assistant ? { parts } : {}),
      ...(files.length ? { files } : {}),
      state: "sent",
      createdAt: new Date(r.createdAt).getTime() || Date.now(),
      seq: r.seq,
      ...(r.authorBotId ? { botId: r.authorBotId } : {}),
    };
  });
}
