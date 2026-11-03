import type { MessagePart } from "@/features/chat/lib/protocol";
import { describe } from "./describe";

/** Short verb phrases for the collapsed row ("Edited a file, shared a file"). */
const PHRASES: Array<[RegExp, string]> = [
  [/^tavily_|search/, "searched the web"],
  [/^(write_file|edit_file)$/, "edited files"],
  [/^share_file$/, "shared a file"],
  [/^generate_image$/, "created an image"],
  [/^copy_to_computer$/, "copied files to the computer"],
  [/^(execute|computer|turn_on_computer)$/, "used the computer"],
  [/subagents$/, "ran sub-agents"],
  [/^(read_file|ls|glob|grep|view_image)$/, "read files"],
];

/** What the finished work did, in one line. */
export function workSummary(work: MessagePart[]): string {
  const done: string[] = [];
  for (const p of work) {
    if (p.type !== "tool") continue;
    const phrase = PHRASES.find(([re]) => re.test(p.name))?.[1] ?? "used tools";
    if (!done.includes(phrase)) done.push(phrase);
  }
  if (done.length === 0) return "Thought";
  const line =
    done.slice(0, 3).join(", ") + (done.length > 3 ? " and more" : "");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** What the agent is doing right now, from its latest step. */
export function currentActivity(work: MessagePart[]): string {
  const last = work.at(-1);
  if (!last || last.type === "reasoning") return "Thinking";
  if (last.type === "tool")
    return describe(last, last.status !== "running").title;
  return "Writing the answer";
}
