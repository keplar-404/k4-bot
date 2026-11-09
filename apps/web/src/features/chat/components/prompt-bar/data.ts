import { ACCENTS, accentChain } from "glimm";
export const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
]);
export type Source = {
  key: string;
  name: string;
  desc: string;
  /** Group in the "@" menu: Files, Apps, Workflows. */
  section: string;
  glyph?: string;
  /** An app's logo URL (Composio catalog). */
  logo?: string | null;
  attach?: boolean;
  /** An app that is not connected yet: its toolkit slug, for the inline Connect link. */
  connect?: string;
};
/** Always first in the "@" menu: attach files from the computer. */
export const ATTACH: Source = {
  key: "attach",
  name: "Add photos & files",
  desc: "Upload from your computer",
  section: "Files",
  glyph: "clip",
  attach: true,
};
export const COMMANDS = [
  // Summarizes the chat on the server to free context (use-chat sends it with `compact`).
  {
    key: "compact",
    name: "/compact",
    desc: "Summarize the chat to free up context",
  },
  // Real: the server sees "/deep-research <question>" and hands it to Tavily's research agent (chat/commands.ts).
  {
    key: "deep-research",
    name: "/deep-research",
    desc: "In-depth research with a cited report",
  },
];
export function parseToken(
  draft: string,
): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}
