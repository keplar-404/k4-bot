/**
 * The structured content of an assistant turn: what the UI renders and what is
 * saved in `chat_message.parts`. Text and reasoning are plain strings; a tool
 * call carries its input and (clipped) output so a reloaded chat still shows
 * every step. Imported by the web app as a type.
 */
export type ToolPart = {
  type: "tool";
  id: string;
  name: string;
  /** Clipped JSON text of the arguments. */
  input: string;
  status: "running" | "done" | "error";
  /** Clipped result text, or the error message. */
  output?: string;
};

export type Part = { type: "text"; text: string } | { type: "reasoning"; text: string } | ToolPart;

export type PartsUsage = { input: number; output: number };

/** Large arguments and outputs (file contents, web pages) are clipped before they are streamed or stored. */
export const MAX_PART_CHARS = 4000;

export function clip(value: unknown): string {
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "");
  return text.length > MAX_PART_CHARS ? `${text.slice(0, MAX_PART_CHARS)}\n…[clipped]` : text;
}
