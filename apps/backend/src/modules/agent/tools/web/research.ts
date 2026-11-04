import { call, compact, TavilyError } from "./client";
import type { Billed } from "./guard";

/**
 * Tavily's research agent: POST /research queues a task, GET /research/{id} returns 202 while it works and 200 when
 * it is completed or failed (https://docs.tavily.com/documentation/api-reference/endpoint/research-get).
 * Polling, not streaming: the chat already shows the tool call as running, and a poll survives a dropped connection.
 */
export interface ResearchParams {
  input: string;
  model?: "mini" | "pro" | "auto";
  citation_format?: "numbered" | "mla" | "apa" | "chicago";
  output_length?: "short" | "standard" | "long";
  include_domains?: string[];
  exclude_domains?: string[];
}

type Task = {
  request_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  content?: string | Record<string, unknown>;
  sources?: Array<{ title?: string; url: string }>;
  usage?: { credits?: number };
};

const POLL_MS = 5_000;
/** Well inside a run slice (20 min), so the report is saved by the slice that asked for it. */
export const RESEARCH_TIMEOUT_MS = 15 * 60_000;

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("Stopped", "AbortError"))), { once: true });
  });

export async function research(apiKey: string, params: ResearchParams, signal?: AbortSignal): Promise<Billed> {
  const started = await call<Task>(apiKey, "/research", compact({ ...params, stream: false }), 30_000);
  const deadline = Date.now() + RESEARCH_TIMEOUT_MS;
  for (;;) {
    await wait(POLL_MS, signal);
    const task = await call<Task>(apiKey, `/research/${encodeURIComponent(started.request_id)}?include_usage=true`, null, 30_000);
    if (task.status === "completed") return { text: report(task), credits: task.usage?.credits };
    if (task.status === "failed") return { text: "NOT DONE: Tavily's research agent could not finish this task. Tell the user, and offer to research it yourself with tavily_search.", credits: task.usage?.credits ?? 0 };
    if (Date.now() > deadline) throw new TavilyError(`Research ${started.request_id} was still running after ${RESEARCH_TIMEOUT_MS / 60_000} minutes.`);
  }
}

function report(task: Task): string {
  const body = typeof task.content === "string" ? task.content : `\`\`\`json\n${JSON.stringify(task.content, null, 2)}\n\`\`\``;
  const sources = (task.sources ?? []).map((s, i) => `${i + 1}. ${s.title ? `${s.title} — ` : ""}${s.url}`);
  return [body, sources.length ? `Sources:\n${sources.join("\n")}` : ""].filter(Boolean).join("\n\n");
}
