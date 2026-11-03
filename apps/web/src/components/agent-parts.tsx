"use client";

import type { SubagentStatus } from "@backend/agent/parts";
import {
  BrainIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleDashedIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  ListChecksIcon,
  ListTreeIcon,
  Loader2Icon,
  MessageCircleQuestionIcon,
  MonitorDownIcon,
  MonitorIcon,
  MonitorUpIcon,
  NetworkIcon,
  PlugIcon,
  PowerIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { FileList } from "@/components/file-card";
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

/** "example.com" from a URL (or the first of a list), for one-line titles. */
const hostOf = (value: unknown) => {
  const url = Array.isArray(value) ? value[0] : value;
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return "a page";
  }
};

/** Live status of a sub-agent group, under its step while it runs. */
function SubagentList({ agents }: { agents: SubagentStatus[] }) {
  return (
    <ul className="ml-6 flex flex-col gap-1 border-l pl-3 text-xs text-muted-foreground">
      {agents.map((agent) => (
        <li key={agent.name} className="flex items-center gap-1.5">
          {agent.status === "running" ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : agent.status === "done" ? (
            <CheckIcon className="size-3 text-foreground" />
          ) : agent.status === "failed" ? (
            <CircleAlertIcon className="size-3 text-destructive" />
          ) : (
            <CircleDashedIcon className="size-3" />
          )}
          <span className="font-medium text-foreground">{agent.name}</span>
          <span>
            {agent.status === "failed"
              ? `failed${agent.note ? `: ${agent.note}` : ""}`
              : agent.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Connected apps (MCP servers), by tool name prefix. */
const APP_NAMES: Record<string, string> = {
  airtable: "Airtable",
  shadcn: "shadcn/ui",
};

/** Title + icon for one tool call, in the user's words rather than the tool's name. */
function describe(
  part: ToolPart,
  done: boolean,
): { icon: ReactNode; title: string } {
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
    case "tavily_search":
      return {
        icon: <SearchIcon />,
        title: `${done ? "Searched" : "Searching"} "${str(a.query, 60)}"`,
      };
    case "tavily_extract": {
      const n = Array.isArray(a.urls) ? a.urls.length : 0;
      return {
        icon: <GlobeIcon />,
        title: `${done ? "Read" : "Reading"} ${n === 1 ? hostOf(a.urls) : `${n} pages`}`,
      };
    }
    case "tavily_map":
      return {
        icon: <NetworkIcon />,
        title: `${done ? "Mapped" : "Mapping"} ${hostOf(a.url)}`,
      };
    case "tavily_crawl":
      return {
        icon: <GlobeIcon />,
        title: `${done ? "Crawled" : "Crawling"} ${hostOf(a.url)}`,
      };
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
    default: {
      // Connected-app (MCP) tools are named "<app>_<tool>": shown as "Airtable: list records".
      const app = Object.entries(APP_NAMES).find(([prefix]) =>
        part.name.startsWith(`${prefix}_`),
      );
      if (app)
        return {
          icon: <PlugIcon />,
          title: `${app[1]}: ${part.name.slice(app[0].length + 1).replace(/_/g, " ")}`,
        };
      return {
        icon: <WrenchIcon />,
        title: `${done ? "Used" : "Using"} ${part.name}`,
      };
    }
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
  // A sub-agent group as its members' tasks.
  if (part.name === "spawn_subagents" && Array.isArray(a.agents))
    return (a.agents as { name?: string; task?: string }[])
      .map((s) => `${s.name ?? "?"}: ${s.task ?? ""}`)
      .join("\n\n");
  // The shell and search tools are clearer as the command itself than as JSON.
  if (part.name === "execute" && typeof a.command === "string")
    return a.command;
  // The plan (Deep Agents' write_todos) as a checklist instead of JSON.
  if (part.name === "write_todos" && Array.isArray(a.todos))
    return (a.todos as { content?: string; status?: string }[])
      .map(
        (t) =>
          `${t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]"} ${t.content ?? ""}`,
      )
      .join("\n");
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
  // What the tool made for the user (an image, a shared file) stays visible under its step; a running sub-agent
  // group shows each member's status.
  const files = part.files?.length ? (
    <FileList files={part.files} />
  ) : running && part.agents?.length ? (
    <SubagentList agents={part.agents} />
  ) : null;

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
  if (!hasDetail)
    return (
      <>
        <Trace>{line}</Trace>
        {files}
      </>
    );

  return (
    <>
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
      {files}
    </>
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
        if (part.type === "file") return null; // only user messages carry these
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
