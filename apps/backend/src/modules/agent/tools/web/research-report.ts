import { fileMarker, type FileRef } from "../../parts";
import type { ResearchTask } from "./research";
import { formatReport } from "./research-format";

/**
 * Most of a report the model gets inline. Deep Agents moves a tool result over 80,000 characters out of the
 * conversation (to /large_tool_results/, leaving a preview), so the inline part stays below that: the model reads the
 * real report, not a preview. Anything longer is in the saved file, which read_document reads page by page.
 */
export const INLINE_CHARS = 60_000;

/** The report as markdown: the question, then Tavily's text (or structured output as JSON) with linked citations. */
export function reportMarkdown(task: Pick<ResearchTask, "content" | "sources">, question: string): string {
  const sources = task.sources ?? [];
  const body =
    typeof task.content === "string"
      ? formatReport(task.content, sources)
      : formatReport(`\`\`\`json\n${JSON.stringify(task.content ?? {}, null, 2)}\n\`\`\``, sources);
  return `> **Deep research** · ${question.replace(/\s+/g, " ").slice(0, 300)}\n\n${body}`;
}

/** A file name from the question: "Deep research - <first words>.md". */
export function reportName(question: string): string {
  const words = question.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().split(/\s+/).slice(0, 8).join(" ");
  return `Deep research - ${words || "report"}.md`;
}

/** What the tool returns: the report (whole, or its start + sources when long) and where the full copy is. */
export function forModel(markdown: string, saved: FileRef | string, reused = false): string {
  const fileId = typeof saved === "string" ? null : saved.id;
  let text = markdown;
  if (markdown.length > INLINE_CHARS) {
    const cut = Math.max(markdown.lastIndexOf("## Sources"), markdown.lastIndexOf("## References"));
    const sources = cut > 0 ? markdown.slice(cut) : "";
    const head = markdown.slice(0, INLINE_CHARS - sources.length);
    const rest = fileId ? `Read the rest with read_document, file id ${fileId}.` : "The rest could not be saved.";
    text = `${head}\n\n…[The report continues for ${markdown.length - head.length - sources.length} more characters. ${rest}]\n\n${sources}`;
  }
  const where =
    typeof saved === "string"
      ? `The full report could not be saved as a file (${saved}); it is only in this conversation.`
      : `The full report is saved as "${saved.name}" (file id ${saved.id}); the user has a download card for it. When asked about this research later, re-read it with read_document instead of relying on memory.`;
  const lines = [reused ? "(This research was already done for the same question; here it is again, at no extra cost.)" : "", text, where, typeof saved === "string" ? "" : fileMarker(saved)];
  return lines.filter(Boolean).join("\n\n");
}
