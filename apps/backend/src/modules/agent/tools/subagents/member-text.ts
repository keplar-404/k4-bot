/** A message's text, whether the provider sent a string or content blocks. */
export const textOf = (message: unknown): string => {
  const m = message as { text?: string; content?: unknown };
  if (typeof m.text === "string" && m.text) return m.text;
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) return m.content.map((b) => (typeof b === "string" ? b : ((b as { text?: string }).text ?? ""))).join("");
  return "";
};

/** A file of the member's own state as text (Deep Agents keeps either a string or a list of lines). */
export const fileText = (data: unknown) => {
  const content = (data as { content?: unknown })?.content;
  return typeof content === "string" ? content : Array.isArray(content) ? content.join("\n") : "";
};
