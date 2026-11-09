import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { workflowRunStep } from "../../../db/schema";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { type ApprovalAnswer, approvalEventType } from "../engine/approval";
import { getRun } from "../store/runs";

const params = z.object({ runId: z.uuid(), nodeId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/) });
const body = z.object({ approved: z.boolean(), note: z.string().max(2000).default("") });

/** The user's answer to an "Ask me first" block: the waiting run wakes up and goes on (or stops that path). */
const answer = new Hono<AuthGuardEnv>().post(
  "/runs/:runId/steps/:nodeId/answer",
  userLimit,
  validate("param", params),
  validate("json", body),
  async (c) => {
    const { db, env } = getRequestContext(c);
    const { runId, nodeId } = c.req.valid("param");
    const run = await getRun(db, c.get("session").user.id, runId);
    if (!run) return c.json({ error: "NOT_FOUND", message: "Run not found." }, 404);
    if (run.status !== "running") return c.json({ error: "NOT_RUNNING", message: "This run already finished." }, 409);

    // Claim the wait: only one answer gets through, even from two tabs.
    const waiting = and(
      eq(workflowRunStep.runId, runId),
      eq(workflowRunStep.nodeId, nodeId),
      eq(workflowRunStep.nodeKind, "logic.approval"),
      eq(workflowRunStep.status, "waiting"),
    );
    const claimed = await db.update(workflowRunStep).set({ status: "running" }).where(waiting).returning();
    if (claimed.length === 0) return c.json({ error: "NOT_WAITING", message: "This step is not waiting for an answer." }, 409);

    const payload: ApprovalAnswer = { ...c.req.valid("json"), at: new Date().toISOString() };
    try {
      await (await env.WORKFLOW_RUN.get(runId)).sendEvent({ type: approvalEventType(nodeId), payload });
    } catch (error) {
      console.error("[workflows] could not deliver an answer", runId, error);
      await db
        .update(workflowRunStep)
        .set({ status: "waiting" })
        .where(and(eq(workflowRunStep.runId, runId), eq(workflowRunStep.nodeId, nodeId)));
      return c.json({ error: "UNAVAILABLE", message: "Could not reach the run. Try again." }, 502);
    }
    return c.json({ ok: true });
  },
);

export default answer;
