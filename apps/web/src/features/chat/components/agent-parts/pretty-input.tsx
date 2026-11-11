"use client";

import { isPlanTool } from "./todo-list";
import type { ToolPart } from "./util";
import { parse } from "./util";

export function prettyInput(part: ToolPart): string {
  const a = parse(part.input);
  if (part.name === "spawn_subagents" && Array.isArray(a.agents))
    return (a.agents as { name?: string; task?: string }[])
      .map((s) => `${s.name ?? "?"}: ${s.task ?? ""}`)
      .join("\n\n");
  if (part.name === "execute" && typeof a.command === "string")
    return a.command;
  if (isPlanTool(part.name) && (Array.isArray(a.steps) || Array.isArray(a.todos))) {
    const list = (Array.isArray(a.steps) ? a.steps : a.todos) as Array<{ title?: string; content?: string; status?: string }>;
    return list
      .map(
        (t) =>
          `${t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : t.status === "cancelled" ? "[-]" : "[ ]"} ${t.title ?? t.content ?? ""}`,
      )
      .join("\n");
  }
  if (Object.keys(a).length === 0) return part.input;
  return JSON.stringify(a, null, 2);
}
