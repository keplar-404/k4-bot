import { call, compact, TavilyError } from "./client";

/**
 * Tavily's research API: POST /research queues a task, GET /research/{id} returns 202 while it works and 200 when it
 * is completed or failed (https://docs.tavily.com/documentation/api-reference/endpoint/research-get).
 * Polling, not streaming: a poll can resume from a saved request id after a crash; a stream cannot.
 */
export interface ResearchParams {
  input: string;
  model?: "mini" | "pro" | "auto";
  citation_format?: "numbered" | "mla" | "apa" | "chicago";
  output_length?: "short" | "standard" | "long";
  include_domains?: string[];
  exclude_domains?: string[];
}

export type ResearchTask = {
  request_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  content?: string | Record<string, unknown>;
  sources?: Array<{ title?: string; url: string }>;
};

/** Well inside a run slice (20 min), so the report is saved by the slice that asked for it. */
export const RESEARCH_TIMEOUT_MS = 15 * 60_000;

export async function startResearch(apiKey: string, params: ResearchParams): Promise<string> {
  const task = await call<ResearchTask>(apiKey, "/research", compact({ ...params, stream: false }), 30_000);
  return task.request_id;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("Stopped", "AbortError"))), { once: true });
  });

/**
 * Polls until the task is completed or failed. Throws TavilyError with status 404 when Tavily no longer knows the id
 * (the caller then starts a new task), and on the timeout. Stop (the run's abort signal) ends the wait at once.
 */
export async function waitForResearch(apiKey: string, requestId: string, o: { signal?: AbortSignal; pollMs?: number } = {}): Promise<ResearchTask> {
  const deadline = Date.now() + RESEARCH_TIMEOUT_MS;
  for (;;) {
    await wait(o.pollMs ?? 5_000, o.signal);
    const task = await call<ResearchTask>(apiKey, `/research/${encodeURIComponent(requestId)}`, null, 30_000);
    if (task.status === "completed" || task.status === "failed") return task;
    if (Date.now() > deadline) throw new TavilyError(`Research ${requestId} was still running after ${RESEARCH_TIMEOUT_MS / 60_000} minutes. Run /deep-research again with the same question to pick it up.`);
  }
}
