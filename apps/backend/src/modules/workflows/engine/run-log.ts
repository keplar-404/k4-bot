import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { workflowRun, workflowRunStep } from "../../../db/schema";
import type { LiveEvent, StepStatus } from "../live/events";
import { publishLive } from "../live/publish";
import type { RunParams } from "./params";

type StepUpdate = Partial<Pick<typeof workflowRunStep.$inferInsert, "attempt" | "input" | "output" | "error">> & {
  status: StepStatus;
  /** For a delay block: when it wakes up. Only sent to the builder, not stored. */
  resumeAt?: Date;
};

const UNFINISHED = ["queued", "running"] as const;
const isDone = (status: StepStatus) => status === "succeeded" || status === "failed" || status === "skipped";

/**
 * A run's record: every change goes to the database first (the source of truth), then to the workflow's open
 * builders over the live socket. Each method is meant to be called inside a `step.do`, so a resumed run does
 * not write twice.
 */
export class RunLog {
  constructor(
    private readonly db: Db,
    private readonly env: Env,
    private readonly run: RunParams,
  ) {}

  /** Marks a queued run as running. False when it was cancelled (or finished) before it started. */
  async start(): Promise<boolean> {
    const now = new Date();
    const started = await this.db
      .update(workflowRun)
      .set({ status: "running", startedAt: now })
      .where(and(eq(workflowRun.id, this.run.runId), inArray(workflowRun.status, UNFINISHED)))
      .returning({ id: workflowRun.id });
    if (started.length === 0) return false;

    await this.publish({ type: "run.started", runId: this.run.runId, at: now.toISOString() });
    return true;
  }

  /**
   * Ends the run. The update only applies while the run is unfinished, so a run the user cancelled is never
   * marked succeeded or failed by a block that finishes late.
   */
  async finish(status: "succeeded" | "failed", details: { error?: string; failedNodeId?: string } = {}) {
    const now = new Date();
    const finished = await this.db
      .update(workflowRun)
      .set({ status, error: details.error, failedNodeId: details.failedNodeId, finishedAt: now })
      .where(and(eq(workflowRun.id, this.run.runId), inArray(workflowRun.status, UNFINISHED)))
      .returning({ id: workflowRun.id });
    if (finished.length === 0) return;

    await this.publish({ type: "run.finished", runId: this.run.runId, status, ...details, at: now.toISOString() });
  }

  private publish(event: LiveEvent) {
    return publishLive(this.env, this.run.workflowId, event);
  }

  async isCancelled(): Promise<boolean> {
    const [row] = await this.db
      .select({ status: workflowRun.status })
      .from(workflowRun)
      .where(eq(workflowRun.id, this.run.runId))
      .limit(1);
    return !row || row.status === "cancelled";
  }

  /** One row per block per run, rewritten on every attempt: the last write is what the run viewer shows. */
  async step(node: { id: string; kind: string }, update: StepUpdate) {
    const { resumeAt, ...fields } = update;
    const now = new Date();
    const times = isDone(update.status) ? { finishedAt: now } : { startedAt: now, finishedAt: null };

    await this.db
      .insert(workflowRunStep)
      .values({ runId: this.run.runId, nodeId: node.id, nodeKind: node.kind, ...fields, ...times })
      .onConflictDoUpdate({
        target: [workflowRunStep.runId, workflowRunStep.nodeId],
        set: { ...fields, ...times },
      });

    await this.publish({
      type: "step",
      runId: this.run.runId,
      nodeId: node.id,
      nodeKind: node.kind,
      status: update.status,
      attempt: update.attempt ?? 1,
      ...(update.error ? { error: update.error } : {}),
      ...(resumeAt ? { resumeAt: resumeAt.toISOString() } : {}),
      at: now.toISOString(),
    });
  }
}
