import type { WorkflowGraph, WorkflowStats } from "./api";

type Node = WorkflowGraph["nodes"][number];

/** How the workflow starts, in words ("Every 2 hours", "When a webhook is called", "Run by hand"). */
export function triggerLabel(graph: WorkflowGraph): string {
  const t = graph.nodes.find((n) => n.kind.startsWith("trigger."));
  if (!t) return "No trigger yet";
  if (t.kind === "trigger.schedule") {
    const { every, unit } = t.config;
    const word = every === 1 ? unit.replace(/s$/, "") : unit;
    return every === 1 ? `Every ${word}` : `Every ${every} ${word}`;
  }
  if (t.kind === "trigger.webhook") return "When a webhook is called";
  return "Run by hand";
}

/** The apps a workflow uses, in order, without repeats (their Composio slugs). */
export function appsOf(graph: WorkflowGraph): string[] {
  const slugs = graph.nodes.flatMap((n: Node) =>
    n.kind === "action.app" && n.config.toolkit ? [n.config.toolkit] : [],
  );
  return [...new Set(slugs)];
}

/** Composio's logo for an app slug (the same URL the catalog stores). */
export const logoOf = (slug: string) =>
  `https://logos.composio.dev/api/${encodeURIComponent(slug)}`;

/** Success rate over the last 7 days as a whole percent, or null when nothing finished. */
export function successRate(s: WorkflowStats | null): number | null {
  if (!s) return null;
  const finished = s.succeeded7d + s.failed7d;
  return finished ? Math.round((s.succeeded7d / finished) * 100) : null;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "3 minutes ago", "yesterday"; "Never" for no date. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  for (const [limit, unit] of steps) {
    if (Math.abs(seconds) < limit) {
      const size =
        {
          second: 1,
          minute: 60,
          hour: 3600,
          day: 86400,
          week: 604800,
          month: 2629800,
        }[unit as string] ?? 1;
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return rtf.format(Math.round(seconds / 31557600), "year");
}
