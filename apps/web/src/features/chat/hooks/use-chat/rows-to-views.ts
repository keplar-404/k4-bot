import type { MessageRow } from "@/features/chat/lib/client";
import type { ChatMessageView } from "@/features/chat/lib/protocol";
import { mergeToolParts, textOfParts } from "@/features/chat/lib/stream";

export function rowsToViews(rows: MessageRow[]): ChatMessageView[] {
  return rows.map((r) => {
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
    };
  });
}
