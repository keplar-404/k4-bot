import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { importDocument } from "../store/import";
import { lockedResponse } from "../store/lock";
import { workflowDto } from "./dto";

const idParam = z.object({ id: z.uuid() });
const importBody = z.object({
  document: z.unknown(),
  /** The `updatedAt` the builder last saw: a save from another tab in between makes this a 409. */
  expectedUpdatedAt: z.iso.datetime().optional(),
});

/**
 * Replaces a workflow's draft with an imported file (store/import.ts strips and validates it). A workflow that is on
 * keeps running its published copy until it is published again.
 */
const importRoute = new Hono<AuthGuardEnv>().post(
  "/:id/import",
  userLimit,
  validate("param", idParam),
  validate("json", importBody),
  async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { id } = c.req.valid("param");
    const locked = await lockedResponse(db, userId, id);
    if (locked) return c.json(locked, 423);
    const { document, expectedUpdatedAt } = c.req.valid("json");
    const result = await importDocument(db, userId, id, document, expectedUpdatedAt);
    if (result.ok) return c.json(workflowDto(result.row));
    const { status, error, message, issues } = result;
    return c.json({ error, message, ...(issues ? { issues } : {}) }, status);
  },
);

export default importRoute;
