import type { Db } from "../../../db";
import { getRun } from "../../workflows/store/runs";
import { asText } from "./common";

const WAIT_MS = 45_000;
const POLL_MS = 1_500;

/** Waits up to WAIT_MS for a run to end, then reports how it went (or that it is still going). */
export async function waitForRun(db: Db, userId: string, runId: string) {
  for (let waited = 0; waited < WAIT_MS; waited += POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const run = await getRun(db, userId, runId);
    if (!run || run.status === "queued") continue;
    // An "Ask me first" block is waiting: only the user can answer it, so say where instead of waiting in silence.
    const asking = run.steps.find((s) => s.nodeKind === "logic.approval" && s.status === "waiting");
    if (asking) {
      const message = (asking.output as { message?: string } | null)?.message ?? "";
      return asText({
        runId,
        status: "waiting_for_approval",
        question: message,
        note: "The run is paused until the user approves. Tell them to approve or decline it on the Approvals page (/dashboard/approvals) or in the workflow builder; then check workflow_run_status.",
      });
    }
    if (run.status === "running") continue;

    const done = run.steps.filter((s) => s.status === "succeeded");
    // A Return block is the workflow's answer; without one, the last outputs are the best guess.
    const returned = done.findLast((s) => s.nodeKind === "logic.return");
    const answer = returned
      ? { result: returned.output }
      : { lastOutputs: done.slice(-3).map((s) => ({ nodeId: s.nodeId, output: s.output })) };
    return asText({ runId, status: run.status, error: run.error, failedNodeId: run.failedNodeId, ...answer }, 8_000);
  }
  return asText({ runId, status: "running", note: "Still going. Check later with workflow_run_status." });
}
