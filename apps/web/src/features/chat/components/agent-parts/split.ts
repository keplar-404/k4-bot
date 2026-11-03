import type { FileRef, MessagePart } from "@/features/chat/lib/protocol";

/**
 * An assistant turn as two parts: the work (thoughts, tool calls, the text written between them) and the final
 * answer (the text after the last step), plus every file a tool produced, deduplicated, shown with the answer.
 */
export function splitParts(parts: MessagePart[]) {
  let lastStep = -1;
  parts.forEach((p, i) => {
    if (p.type === "tool" || p.type === "reasoning") lastStep = i;
  });
  const work = parts.slice(0, lastStep + 1);
  const answer = parts.slice(lastStep + 1).filter((p) => p.type === "text");
  const seen = new Set<string>();
  const files: FileRef[] = [];
  for (const p of work) {
    if (p.type !== "tool") continue;
    for (const f of p.files ?? []) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      files.push(f);
    }
  }
  return { work, answer, files };
}
