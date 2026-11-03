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
  /** Files the tool stored for the user (a created image, a file shared from the computer). */
  files?: FileRef[];
  /** spawn_subagents only, while it runs: each sub-agent's status (live in the chat, not stored). */
  agents?: SubagentStatus[];
};

export type SubagentStatus = { name: string; status: "queued" | "running" | "done" | "failed"; note?: string };

/** A stored file (R2 + the `chat_file` row), as messages carry it. Downloaded through GET /files/:id/content. */
export type FileRef = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  source: "upload" | "generated" | "computer";
};

export type Part =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | ToolPart
  /** A file the user attached to their message. */
  | { type: "file"; file: FileRef };

export type PartsUsage = { input: number; output: number };

/** Large arguments and outputs (file contents, web pages) are clipped before they are streamed or stored. */
export const MAX_PART_CHARS = 4000;

export function clip(value: unknown): string {
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "");
  return text.length > MAX_PART_CHARS ? `${text.slice(0, MAX_PART_CHARS)}\n…[clipped]` : text;
}

/*
 * A tool reports a stored file with one marker line in its result. The stream only passes a tool's text
 * content (a ToolMessage artifact is dropped), so the marker travels in the text and the run lifts it into
 * `ToolPart.files`. The model sees the line too, which tells it the file id.
 */
const FILE_MARKER = "FILE_REF ";

export const fileMarker = (file: FileRef) => `${FILE_MARKER}${JSON.stringify(file)}`;

/** Splits a tool result into its text (markers removed) and the files it reported. */
export function takeFileMarkers(text: string): { text: string; files: FileRef[] } {
  const files: FileRef[] = [];
  const lines = text.split("\n").filter((line) => {
    if (!line.startsWith(FILE_MARKER)) return true;
    try {
      const f = JSON.parse(line.slice(FILE_MARKER.length)) as FileRef;
      if (typeof f.id === "string" && typeof f.name === "string") files.push(f);
    } catch {
      return true;
    }
    return false;
  });
  return { text: lines.join("\n").trimEnd(), files };
}
