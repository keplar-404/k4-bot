"use client";

import {
  BrainIcon,
  CircleAlertIcon,
  ClockIcon,
  FileTextIcon,
  ListChecksIcon,
  MessageCircleQuestionIcon,
  MonitorIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
} from "@/components/ui/code-block";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { MessagePart } from "@/lib/chat/protocol";

type ToolPart = Extract<MessagePart, { type: "tool" }>;

function parse(input: string): Record<string, unknown> {
  try {
    const value = JSON.parse(input);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const str = (v: unknown, max = 80) => {
  const s = typeof v === "string" ? v : "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

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

/** Title + icon for one tool call, in the user's words rather than the tool's name. */
function describe(
  part: ToolPart,
  done: boolean,
): { icon: ReactNode; title: string } {
  const a = parse(part.input);
  switch (part.name) {
    case "computer":
      return { icon: <MonitorIcon />, title: computerSentence(a, done) };
    case "execute":
      return {
        icon: <TerminalIcon />,
        title: `${done ? "Ran" : "Running"} ${str(a.command, 70)}`,
      };
    case "internet_search":
      return {
        icon: <SearchIcon />,
        title: `${done ? "Searched" : "Searching"} "${str(a.query, 60)}"`,
      };
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
    case "write_todos":
      return {
        icon: <ListChecksIcon />,
        title: done ? "Updated the plan" : "Updating the plan",
      };
    case "read_file":
    case "write_file":
    case "edit_file":
    case "ls":
    case "glob":
    case "grep": {
      const verb: Record<string, [string, string]> = {
        read_file: ["Read", "Reading"],
        write_file: ["Wrote", "Writing"],
        edit_file: ["Edited", "Editing"],
        ls: ["Listed", "Listing"],
        glob: ["Searched files", "Searching files"],
        grep: ["Searched files", "Searching files"],
      };
      const target = str(a.file_path ?? a.path ?? a.pattern, 60);
      return {
        icon: <FileTextIcon />,
        title: `${verb[part.name]![done ? 0 : 1]} ${target}`.trim(),
      };
    }
    default:
      return {
        icon: <WrenchIcon />,
        title: `${done ? "Used" : "Using"} ${part.name}`,
      };
  }
}

function Output({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <CodeBlock size="sm">
        <CodeBlockContent wrap className="max-h-64">
          {text.split("\n").map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
            <CodeBlockLine key={i}>{line || " "}</CodeBlockLine>
          ))}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  );
}

function prettyInput(part: ToolPart): string {
  const a = parse(part.input);
  // The shell and search tools are clearer as the command itself than as JSON.
  if (part.name === "execute" && typeof a.command === "string")
    return a.command;
  if (Object.keys(a).length === 0) return part.input;
  return JSON.stringify(a, null, 2);
}

/** `streaming`: the message is still being written, so an unfinished tool call is really running. */
function ToolStep({ part, streaming }: { part: ToolPart; streaming: boolean }) {
  const running = part.status === "running" && streaming;
  // A call that never finished and is no longer running (a closed tab, a crashed run) is shown as stopped.
  const stopped = part.status === "running" && !streaming;
  const failed = part.status === "error" || stopped;
  const { icon, title } = describe(part, !running);
  const hasDetail = Boolean(part.input || part.output);

  const line = (
    <TraceLine status={running ? "running" : failed ? "error" : undefined}>
      <TraceIcon>{failed ? <CircleAlertIcon /> : icon}</TraceIcon>
      <TraceTitle>
        {failed && !stopped
          ? `Failed: ${title}`
          : stopped
            ? `Stopped: ${title}`
            : title}
      </TraceTitle>
    </TraceLine>
  );
  if (!hasDetail) return <Trace>{line}</Trace>;

  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <div className="flex flex-col gap-3">
            {part.name !== "ask_user" && part.name !== "wait_for" && (
              <Output label="Input" text={prettyInput(part)} />
            )}
            <Output
              label={failed ? "Error" : "Result"}
              text={part.output ?? ""}
            />
          </div>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

/** Reasoning: "Thinking" while it streams, "Thought" after; the text is one click away. */
function ReasoningStep({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={streaming ? "running" : undefined}>
            <TraceIcon>
              <BrainIcon />
            </TraceIcon>
            <TraceTitle>{streaming ? "Thinking" : "Thought"}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <div className="text-sm text-muted-foreground">
            <Markdown isStreaming={streaming}>{text}</Markdown>
          </div>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

/**
 * An assistant turn: every part in the order it happened. Steps (reasoning, tool calls) are quiet
 * one-line traces that open on click; the answer text is rendered as markdown.
 */
export function AgentParts({
  parts,
  streaming,
}: {
  parts: MessagePart[];
  streaming: boolean;
}) {
  const lastIndex = parts.length - 1;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {parts.map((part, i) => {
        // Reasoning is "live" only while it is the newest part of a message still being written.
        const live = streaming && i === lastIndex;
        if (part.type === "text") {
          return part.text ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
            <Markdown key={i} isStreaming={live}>
              {part.text}
            </Markdown>
          ) : null;
        }
        if (part.type === "reasoning") {
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
          return <ReasoningStep key={i} text={part.text} streaming={live} />;
        }
        return (
          <ToolStep key={part.id || i} part={part} streaming={streaming} />
        );
      })}
    </div>
  );
}
