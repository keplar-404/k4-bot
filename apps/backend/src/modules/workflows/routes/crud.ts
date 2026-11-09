import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit, workflowSaveLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { graphSchema } from "../graph/schema";
import { structureIssues } from "../graph/validate";
import { removeWorkflow } from "../store/remove";
import { dailyRuns, statsByWorkflow } from "../store/runs";
import * as store from "../store/workflows";
import { workflowDto } from "./dto";

const idParam = z.object({ id: z.uuid() });
const name = z.string().trim().min(1).max(80);
const createBody = z.object({ name: name.default("Untitled workflow") });
const saveBody = z.object({
  name: name.optional(),
  description: z.string().max(500).optional(),
  graph: graphSchema.optional(),
  /** The `updatedAt` the client last saw: a newer save from another tab wins, and this one gets a 409. */
  expectedUpdatedAt: z.iso.datetime().optional(),
});

const NOT_FOUND = { error: "NOT_FOUND", message: "Workflow not found." } as const;

/** Create, list, read, save (the draft) and delete the signed-in user's workflows. */
const crud = new Hono<AuthGuardEnv>()
  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const [rows, stats, daily] = await Promise.all([
      store.listWorkflows(db, userId),
      statsByWorkflow(db, userId),
      dailyRuns(db, userId),
    ]);
    const statsById = new Map(stats.map((s) => [s.workflowId, s]));
    const items = rows.map((w) => ({ ...workflowDto(w), stats: statsById.get(w.id) ?? null }));
    return c.json({ items, daily });
  })

  .post("/", userLimit, validate("json", createBody), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if ((await store.countWorkflows(db, userId)) >= store.MAX_WORKFLOWS) {
      const message = `You can have up to ${store.MAX_WORKFLOWS} workflows. Delete one to make room.`;
      return c.json({ error: "LIMIT", message }, 409);
    }
    const created = await store.createWorkflow(db, userId, c.req.valid("json").name);
    return c.json(workflowDto(created), 201);
  })

  .get("/:id", validate("param", idParam), async (c) => {
    const { db } = getRequestContext(c);
    const found = await store.getWorkflow(db, c.get("session").user.id, c.req.valid("param").id);
    if (!found) return c.json(NOT_FOUND, 404);
    return c.json(workflowDto(found));
  })

  // Autosave: the draft only. A live workflow keeps running its published copy until it is published again.
  .put("/:id", workflowSaveLimit, validate("param", idParam), validate("json", saveBody), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { id } = c.req.valid("param");
    const { expectedUpdatedAt, ...patch } = c.req.valid("json");

    if (patch.graph) {
      const issues = structureIssues(patch.graph);
      if (issues.length > 0) {
        return c.json({ error: "INVALID_GRAPH", message: issues[0]!.message, issues }, 422);
      }
    }

    const saved = await store.saveDraft(db, userId, id, patch, expectedUpdatedAt);
    if (saved) return c.json(workflowDto(saved));
    if (!(await store.getWorkflow(db, userId, id))) return c.json(NOT_FOUND, 404);
    const message = "This workflow was changed in another tab. Reload to see the latest version.";
    return c.json({ error: "CONFLICT", message }, 409);
  })

  .delete("/:id", userLimit, validate("param", idParam), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { id } = c.req.valid("param");

    const found = await store.getWorkflow(db, userId, id);
    if (!found || !(await removeWorkflow(env, db, userId, found))) return c.json(NOT_FOUND, 404);
    return c.json({ ok: true });
  });

export default crud;
