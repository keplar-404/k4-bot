import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { workflowRun } from "../../../db/schema";
import { workflowHookLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { timingSafeEqualString } from "../../../shared/relay-token";
import { RunStartError, startRun } from "../engine/start";
import { hashToken } from "../graph/triggers";
import { getWorkflowForHook, type WorkflowRow } from "../store/workflows";

const MAX_BODY_BYTES = 256 * 1024;
const params = z.object({ id: z.uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
/** The only request headers a run ever sees: never authorization or cookies. */
const KEPT_HEADERS = ["content-type", "user-agent", "x-request-id"];

const NOT_FOUND = { error: "NOT_FOUND" } as const;
const TOO_LARGE = { error: "TOO_LARGE", message: "The body is too large (256 KB at most)." } as const;

/**
 * The public webhook: POST /api/v1/hooks/:id/:token. There is no session; the secret token IS the credential.
 * Every refusal before the token is checked looks the same (404), so ids and tokens cannot be probed.
 */
const hooks = new Hono<{ Bindings: Env }>().post("/:id/:token", workflowHookLimit, async (c) => {
  const parsed = params.safeParse(c.req.param());
  if (!parsed.success) return c.json(NOT_FOUND, 404);
  const { id, token } = parsed.data;

  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return c.json({ error: "UNSUPPORTED", message: "Send application/json." }, 415);
  }
  if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return c.json(TOO_LARGE, 413);
  // The header can lie or be missing (chunked uploads): measure what actually arrived.
  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return c.json(TOO_LARGE, 413);

  const { db, env } = getRequestContext(c);
  const found = await getWorkflowForHook(db, id);
  if (!found || !(await tokenMatches(found, token))) return c.json(NOT_FOUND, 404);

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return c.json({ error: "INVALID_JSON", message: "The body is not valid JSON." }, 400);
  }

  if (await isOwnRun(db, id, c.req.header("x-k4-workflow-run"))) {
    return c.json({ error: "LOOP", message: "A workflow cannot start itself." }, 409);
  }

  const headers: Record<string, string> = {};
  for (const name of KEPT_HEADERS) {
    const value = c.req.header(name);
    if (value) headers[name] = value.slice(0, 200);
  }

  try {
    const run = await startRun(env, db, {
      workflowId: id,
      userId: found.userId,
      trigger: "webhook",
      graph: found.publishedGraph,
      input: { body, headers, receivedAt: new Date().toISOString() },
    });
    return c.json({ runId: run.id }, 202);
  } catch (error) {
    if (!(error instanceof RunStartError)) throw error;
    // NOT_FOUND here would mean it was deleted mid-request; the caller learns nothing new from a 422.
    const status = error.status === 404 ? 422 : error.status;
    return c.json({ error: error.code, message: error.message }, status);
  }
});

/** Only an active webhook workflow answers, and only to its own token (compared as hashes, in constant time). */
async function tokenMatches(w: WorkflowRow, token: string) {
  const live = w.status === "active" && w.triggerKind === "trigger.webhook" && w.publishedGraph;
  if (!live || !w.webhookTokenHash) return false;
  return timingSafeEqualString(await hashToken(token), w.webhookTokenHash);
}

/**
 * A workflow whose own HTTP block calls its own webhook URL would loop forever through the outside world. Its runs
 * send x-k4-workflow-run, so a call made by one of this workflow's runs is refused.
 */
async function isOwnRun(db: Db, workflowId: string, runId: string | undefined) {
  if (!runId) return false;
  const [own] = await db
    .select({ id: workflowRun.id })
    .from(workflowRun)
    .where(and(eq(workflowRun.id, runId), eq(workflowRun.workflowId, workflowId)))
    .limit(1);
  return Boolean(own);
}

export default hooks;
