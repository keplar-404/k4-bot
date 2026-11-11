import { triggerLabel } from "../describe";
import { infoOf } from "./block-catalog";
import type { BlockBody } from "./blocks";

/** "GMAIL_SEND_EMAIL" (from app "gmail") → "Send email". */
export function actionName(tool: string, toolkit?: string): string {
  const prefix = toolkit ? `${toolkit.toUpperCase()}_` : "";
  const rest = tool.startsWith(prefix) ? tool.slice(prefix.length) : tool;
  const words = rest.toLowerCase().replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "google_calendar" → "Google calendar" (until the catalog's real name is known). */
export const appName = (slug: string) => {
  const words = slug.replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The small grey line above a block's title: what kind of block it is. */
export function blockKindLabel(b: BlockBody): string {
  if (b.kind === "action.app" || b.kind === "trigger.app")
    return b.config.toolkit ? appName(b.config.toolkit) : "App";
  return infoOf(b.kind)?.title ?? b.kind;
}

/** The URL's host, or null while it is empty, half typed or a template like {{trigger.body.url}} (new URL would throw). */
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
};

/** The block's title: the user's label, else what it does. */
export function blockTitle(b: BlockBody): string {
  if (b.label) return b.label;
  switch (b.kind) {
    case "action.app":
      return b.config.tool
        ? actionName(b.config.tool, b.config.toolkit)
        : "Choose an action";
    case "trigger.manual":
    case "trigger.schedule":
    case "trigger.webhook":
    case "trigger.app":
      return triggerLabel({
        nodes: [{ ...b, position: { x: 0, y: 0 } }],
        edges: [],
      });
    case "logic.delay":
      if (b.config.mode === "until") return "Wait until a date";
      if (b.config.mode === "next") return `Wait until ${b.config.at}`;
      return `Wait ${b.config.amount} ${b.config.amount === 1 ? b.config.unit.replace(/s$/, "") : b.config.unit}`;
    case "action.code":
      return "Run code";
    case "logic.if":
      return "Check a condition";
    case "logic.filter":
      return "Continue only if…";
    case "logic.set":
      return `Set ${b.config.fields.length} field${b.config.fields.length === 1 ? "" : "s"}`;
    case "logic.return":
      return "The workflow's answer";
    case "action.http":
      return hostOf(b.config.url) ?? "HTTP request";
    case "ai.bot":
      return b.config.prompt.trim()
        ? b.config.prompt.trim().slice(0, 40)
        : "Ask a bot";
    case "ai.decide":
      return (
        b.config.questions[0]?.instructions.trim().slice(0, 40) || "Decide"
      );
    case "logic.format":
      return `Format: ${b.config.operation.replaceAll("_", " ")}`;
    case "logic.merge":
      return `Merge: ${b.config.mode.replaceAll("_", " ")}`;
    case "logic.list":
      return `List: ${b.config.operation.replaceAll("_", " ")}${b.config.field ? ` ${b.config.field}` : ""}`;
    case "logic.switch":
      return `${b.config.rules.length} paths${b.config.otherwise ? " + otherwise" : ""}`;
    case "logic.loop":
      return "Repeat for each item";
    case "logic.approval":
      return b.config.message.trim()
        ? b.config.message.trim().slice(0, 40)
        : "Wait for my OK";
  }
}
