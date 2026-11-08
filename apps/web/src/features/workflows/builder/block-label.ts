import { triggerLabel } from "../describe";
import { infoOf } from "./block-catalog";
import type { Block, BlockBody } from "./blocks";

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
  if (b.kind === "action.app")
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
      return triggerLabel({
        nodes: [{ ...b, position: { x: 0, y: 0 } }],
        edges: [],
      });
    case "logic.delay":
      return `Wait ${b.config.amount} ${b.config.amount === 1 ? b.config.unit.replace(/s$/, "") : b.config.unit}`;
    case "logic.if":
      return "Check a condition";
    case "logic.filter":
      return "Continue only if…";
    case "logic.set":
      return `Set ${b.config.fields.length} field${b.config.fields.length === 1 ? "" : "s"}`;
    case "action.http":
      return hostOf(b.config.url) ?? "HTTP request";
  }
}
