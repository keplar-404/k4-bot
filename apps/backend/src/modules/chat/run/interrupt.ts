import type { PendingInterrupt } from "../../agent/run-stream";
import { MAX_SLEEP_MS, type Publish, type SliceResult } from "./types";

/**
 * The run paused: tells the clients what it waits for (an approval, an answer, or the clock) and how the workflow
 * goes on. Clients show a question, approval or sleep until told the run went on.
 */
export async function pauseFor(interrupt: PendingInterrupt, publish: Publish): Promise<SliceResult> {
  const payload = (interrupt.payload ?? {}) as { actionRequests?: unknown; kind?: string; question?: string; ms?: number; reason?: string };
  if (payload.actionRequests) {
    await publish("run.waiting_approval", { actions: payload.actionRequests });
    return { status: "needs_input", kind: "approval" };
  }
  if (payload.kind === "sleep") {
    const ms = Math.min(Math.max(Number(payload.ms) || 60_000, 60_000), MAX_SLEEP_MS);
    await publish("run.sleeping", { until: Date.now() + ms, reason: payload.reason ?? "" });
    return { status: "sleep", ms };
  }
  await publish("run.waiting_input", { kind: payload.kind ?? "info", question: payload.question ?? "The bot needs your input." });
  return { status: "needs_input", kind: "answer" };
}
