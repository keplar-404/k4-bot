"use client";

import {
  ClockIcon,
  EyeIcon,
  ImageIcon,
  ListChecksIcon,
  MessageCircleQuestionIcon,
  PlugIcon,
  WrenchIcon,
} from "lucide-react";
import type { ToolPart } from "./util";
import { parse, str, type ToolDesc } from "./util";

const APP_NAMES: Record<string, string> = {
  airtable: "Airtable",
  shadcn: "shadcn/ui",
};

export function describeOther(part: ToolPart, done: boolean): ToolDesc | null {
  const a = parse(part.input);
  switch (part.name) {
    case "ask_user":
      return {
        icon: <MessageCircleQuestionIcon />,
        title: `${done ? "Asked you" : "Asking you"}: ${str(a.question, 60)}`,
      };
    case "wait_for":
      return {
        icon: <ClockIcon />,
        title: `${done ? "Waited" : "Waiting"}: ${str(a.reason, 60)}`,
      };
    case "generate_image":
      return {
        icon: <ImageIcon />,
        title: done ? "Created an image" : "Creating an image",
      };
    case "view_image":
      return {
        icon: <EyeIcon />,
        title: done ? "Looked at an image" : "Looking at an image",
      };
    case "write_todos":
      return {
        icon: <ListChecksIcon />,
        title: done ? "Updated the plan" : "Updating the plan",
      };
    default: {
      const app = Object.entries(APP_NAMES).find(([prefix]) =>
        part.name.startsWith(`${prefix}_`),
      );
      if (app)
        return {
          icon: <PlugIcon />,
          title: `${app[1]}: ${part.name.slice(app[0].length + 1).replace(/_/g, " ")}`,
        };
      // fall through to null -> caller uses generic fallback
      return null;
    }
  }
}
