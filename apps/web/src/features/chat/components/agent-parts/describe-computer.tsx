"use client";

import {
  MonitorDownIcon,
  MonitorIcon,
  MonitorUpIcon,
  PowerIcon,
  TerminalIcon,
} from "lucide-react";
import type { ToolPart } from "./util";
import { parse, str, type ToolDesc } from "./util";

/** The computer tool's action as a short sentence ("Clicked (520, 760)"). */
function computerSentence(a: Record<string, unknown>, done: boolean): string {
  const at =
    typeof a.x === "number" && typeof a.y === "number"
      ? ` (${a.x}, ${a.y})`
      : "";
  switch (a.action) {
    case "screenshot":
      return done ? "Looked at the screen" : "Looking at the screen";
    case "left_click":
      return `${done ? "Clicked" : "Clicking"}${at}`;
    case "right_click":
      return `${done ? "Right-clicked" : "Right-clicking"}${at}`;
    case "double_click":
      return `${done ? "Double-clicked" : "Double-clicking"}${at}`;
    case "middle_click":
      return `${done ? "Middle-clicked" : "Middle-clicking"}${at}`;
    case "mouse_move":
      return `${done ? "Moved the mouse" : "Moving the mouse"}${at}`;
    case "left_click_drag":
      return done ? "Dragged" : "Dragging";
    case "type":
      return `${done ? "Typed" : "Typing"} "${str(a.text, 40)}"`;
    case "key":
      return `${done ? "Pressed" : "Pressing"} ${str(a.keys, 40)}`;
    case "scroll":
      return `${done ? "Scrolled" : "Scrolling"} ${str(a.direction, 10)}`;
    case "wait":
      return done ? "Waited" : "Waiting";
    case "open_url":
      return `${done ? "Opened" : "Opening"} ${str(a.url, 60)}`;
    default:
      return done ? "Used the computer" : "Using the computer";
  }
}

export function describeComputer(
  part: ToolPart,
  done: boolean,
): ToolDesc | null {
  const a = parse(part.input);
  switch (part.name) {
    case "computer":
      return { icon: <MonitorIcon />, title: computerSentence(a, done) };
    case "turn_on_computer":
      return {
        icon: <PowerIcon />,
        title: done ? "Turned on the computer" : "Turning on the computer",
      };
    case "turn_off_computer":
      return {
        icon: <PowerIcon />,
        title: done ? "Turned off the computer" : "Turning off the computer",
      };
    case "execute":
      return {
        icon: <TerminalIcon />,
        title: `${done ? "Ran" : "Running"} ${str(a.command, 70)}`,
      };
    case "share_file": {
      const name = str(a.path, 200).split("/").pop() || "a file";
      return {
        icon: <MonitorDownIcon />,
        title: `${done ? "Shared" : "Sharing"} ${str(name, 60)} from the computer`,
      };
    }
    case "copy_to_computer":
      return {
        icon: <MonitorUpIcon />,
        title: `${done ? "Copied a file to" : "Copying a file to"} ${str(a.path, 50) || "the computer"}`,
      };
    default:
      return null;
  }
}
