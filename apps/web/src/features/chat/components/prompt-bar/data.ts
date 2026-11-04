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
  glyph?: string;
  brand?: string;
  attach?: boolean;
  connect?: boolean;
};
export const SOURCES: Source[] = [
  {
    key: "attach",
    name: "Add photos & files",
    desc: "Upload from your computer",
    glyph: "clip",
    attach: true,
  },
  {
    key: "scoop",
    name: "Scoop Data",
    desc: "Sales & churn metrics",
    glyph: "chart",
  },
  {
    key: "flavors",
    name: "Flavor records",
    desc: "26 makers, tags, links",
    glyph: "layers",
  },
  {
    key: "web",
    name: "Web search",
    desc: "Real-time news and info",
    glyph: "globe",
  },
  {
    key: "figma",
    name: "Figma",
    desc: "Design-to-code workflows",
    brand: "figma",
  },
  {
    key: "slack",
    name: "Slack",
    desc: "Read and manage Slack",
    brand: "slack",
  },
  {
    key: "gmail",
    name: "Gmail",
    desc: "Read and manage Gmail",
    brand: "gmail",
    connect: true,
  },
];
export const COMMANDS = [
  // Real: summarizes the chat on the server to free context (use-chat sends it with `compact`). The rest are the demo.
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
  { key: "compare", name: "/compare", desc: "Flavor vs. last summer" },
  { key: "churn-plan", name: "/churn-plan", desc: "Draft a churn schedule" },
  { key: "restock", name: "/restock", desc: "Build a reorder list" },
  { key: "draft-email", name: "/draft-email", desc: "Write a supplier email" },
  { key: "summarize", name: "/summarize", desc: "Digest the thread so far" },
];
export const DICTATION = "Compare pistachio weekends to last summer";
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
