"use client";

import { ListTreeIcon, MessageCircleQuestionIcon } from "lucide-react";
import type { ToolPart } from "./util";
import { parse, str, type ToolDesc } from "./util";

export function describeSubagents(
  part: ToolPart,
  done: boolean,
): ToolDesc | null {
  const a = parse(part.input);
  switch (part.name) {
    case "wait_for_subagents":
      return {
        icon: <ListTreeIcon />,
        title: done ? "Heard back from sub-agents" : "Waiting for sub-agents",
      };
    case "message_subagents":
      return {
        icon: <MessageCircleQuestionIcon />,
        title: `${done ? "Messaged" : "Messaging"} ${a.to === "all" ? "all sub-agents" : str(a.to, 40)}`,
      };
    case "spawn_subagents": {
      const n = Array.isArray(a.agents) ? a.agents.length : 0;
      return {
        icon: <ListTreeIcon />,
        title: `${done ? "Ran" : "Running"} ${n} sub-agent${n === 1 ? "" : "s"}`,
      };
    }
    default:
      return null;
  }
}
