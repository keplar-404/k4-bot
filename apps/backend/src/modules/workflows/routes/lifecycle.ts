import { lockedResponse } from "../store/lock";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { newWebhookToken, triggerOf } from "../graph/triggers";
import { pauseWorkflow, publishWorkflow } from "../store/publish";
import { getWorkflow, setStatus } from "../store/workflows";
import { workflowDto } from "./dto";

const idParam = z.object({ id: z.uuid() });
const notFound = { error: "NOT_FOUND", message: "Workflow not found." } as const;

/**
 * Turning a workflow on and off. Publishing re-validates the whole draft on the server, freezes it as the copy that
 * runs, and (for a webhook trigger) creates its secret token, returned once.
 */
const lifecycle = new Hono<AuthGuardEnv>()
  .post("/:id/publish", userLimit, validate("param", idParam), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const w = await getWorkflow(db, userId, c.req.valid("param").id);
    if (!w) return c.json(notFound, 404);
    // A half-built draft must not go live while the assistant is still working on it.
    const locked = await lockedResponse(db, userId, w.id);
    if (locked) return c.json(locked, 423);
    const r = await publishWorkflow(env, db, userId, w);
    if (!r.ok) return c.json({ error: r.error, message: r.message, issues: r.issues }, r.status);
    return c.json({ ...workflowDto(r.row), webhookToken: r.webhookToken });
  })

  .post("/:id/pause", userLimit, validate("param", idParam), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const w = await getWorkflow(db, userId, c.req.valid("param").id);
    if (!w) return c.json(notFound, 404);
    const row = await pauseWorkflow(env, db, userId, w);
    return row ? c.json(workflowDto(row)) : c.json(notFound, 404);
  })

  // A new webhook secret (the old URL stops working at once): for a leaked URL.
  .post("/:id/webhook-token", userLimit, validate("param", idParam), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const w = await getWorkflow(db, userId, c.req.valid("param").id);
    if (!w) return c.json(notFound, 404);
    if (triggerOf(w.publishedGraph ?? w.graph)?.kind !== "trigger.webhook") {
      return c.json({ error: "NO_WEBHOOK", message: "This workflow is not started by a webhook." }, 400);
    }
    const { token, hash } = await newWebhookToken();
    await setStatus(db, userId, w.id, { webhookTokenHash: hash });
    return c.json({ webhookToken: token });
  });

export default lifecycle;
