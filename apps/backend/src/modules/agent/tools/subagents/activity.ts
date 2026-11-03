import { createMiddleware } from "langchain";

const short = (value: unknown, max = 80) => {
  const text = typeof value === "string" ? value : (JSON.stringify(value ?? "") ?? "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/** What a sub-agent is doing, in a few words for the chat ("Searching …", "Message to lead: …"). */
export function describeMemberTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "tavily_search":
      return `Searching "${short(args.query)}"`;
    case "tavily_extract":
      return `Reading ${short(Array.isArray(args.urls) ? args.urls.join(", ") : args.urls)}`;
    case "tavily_map":
    case "tavily_crawl":
      return `Exploring ${short(args.url)}`;
    case "send_message":
      return `Message to ${String(args.to ?? "?")}: ${short(args.text, 60)}`;
    case "ask_lead":
      return `Asked the lead: ${short(args.question, 60)}`;
    case "write_file":
    case "edit_file":
      return `Writing ${short(args.file_path ?? args.path)}`;
    case "read_file":
      return `Reading ${short(args.file_path ?? args.path)}`;
    case "ls":
    case "glob":
    case "grep":
      return "Looking through files";
    default:
      return `Using ${name}`;
  }
}

/** Reports each model call and tool call of a sub-agent, so the chat can show what it is doing right now. */
export function createActivityMiddleware(onActivity: (text: string) => void) {
  return createMiddleware({
    name: "MemberActivityMiddleware",
    wrapModelCall: (request, handler) => {
      onActivity("Thinking");
      return handler(request);
    },
    wrapToolCall: (request, handler) => {
      const call = request.toolCall;
      onActivity(describeMemberTool(call.name, (call.args ?? {}) as Record<string, unknown>));
      return handler(request);
    },
  });
}
