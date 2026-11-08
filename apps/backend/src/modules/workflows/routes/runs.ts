import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit, workflowRunLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { RunStartError, startRun } from "../engine/start";
import { triggerOf } from "../graph/triggers";
import { publishLive } from "../live/publish";
import { cancelRunRow } from "../store/run-control";
import { getRun } from "../store/runs";
import { getWorkflow } from "../store/workflows";

const idParam = z.object({ id: z.uuid() });
const runIdParam = z.object({ runId: z.uuid() });
const runBody = z.object({
  /** "test" runs the draft; "live" runs the published copy of a workflow that is on. */
  mode: z.enum(["live", "test"]).default("test"),
  input: z.unknown().optional(),
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What the trigger block hands the first step, so a test run looks like the real thing. */
function triggerInput(kind: string | undefined, input: unknown) {
  const now = new Date().toISOString();
  if (kind === "trigger.webhook") return { body: input ?? {}, headers: {}, receivedAt: now };
  if (kind === "trigger.schedule") return { scheduledAt: now };
  return { inputs: isPlainObject(input) ? input : {} };
}

/** Start and cancel runs. */
const runs = new Hono<AuthGuardEnv>()
  .post("/:id/run", workflowRunLimit, validate("param", idParam), validate("json", runBody), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { mode, input } = c.req.valid("json");
    const found = await getWorkflow(db, userId, c.req.valid("param").id);
    if (!found) return c.json({ error: "NOT_FOUND", message: "Workflow not found." }, 404);

    const graph = mode === "test" ? found.graph : found.publishedGraph;
    if (!graph || (mode === "live" && found.status !== "active")) {
      return c.json({ error: "NOT_READY", message: "Turn the workflow on first." }, 422);
    }
    if (mode === "live" && found.triggerKind !== "trigger.manual") {
      const message = "Only workflows started by hand can be run here. Use a test run.";
      return c.json({ error: "NOT_READY", message }, 422);
    }

    try {
      const run = await startRun(env, db, {
        workflowId: found.id,
        userId,
        trigger: mode === "test" ? "test" : "manual",
        graph,
        input: triggerInput(triggerOf(graph)?.kind, input),
      });
      return c.json({ run }, 201);
    } catch (error) {
      if (error instanceof RunStartError) {
        return c.json({ error: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  })

  .post("/runs/:runId/cancel", userLimit, validate("param", runIdParam), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { runId } = c.req.valid("param");

    // The row says cancelled first, so even a step that is mid-flight cannot bring the run back.
    const cancelled = await cancelRunRow(db, userId, runId);
    if (!cancelled) {
      const exists = await getRun(db, userId, runId);
      if (!exists) return c.json({ error: "NOT_FOUND", message: "Run not found." }, 404);
      return c.json({ error: "NOT_RUNNING", message: "This run already finished." }, 409);
    }

    try {
      await (await env.WORKFLOW_RUN.get(runId)).terminate();
    } catch {
      // Already over, or never started: the row is what counts.
    }
    await publishLive(env, cancelled.workflowId, {
      type: "run.finished",
      runId,
      status: "cancelled",
      at: new Date().toISOString(),
    });
    return c.json({ ok: true });
  });

export default runs;
