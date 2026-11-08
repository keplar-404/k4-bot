import { Hono } from "hono";
import { z } from "zod";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { botIdsOf, setSharedBots } from "../store/bot-access";
import { getWorkflow } from "../store/workflows";

const idParam = z.object({ id: z.uuid() });
const notFound = { error: "NOT_FOUND", message: "Workflow not found." } as const;

/** Which of the user's bots may see and run a workflow. */
const share = new Hono<AuthGuardEnv>()
  .get("/:id/bots", validate("param", idParam), async (c) => {
    const { db } = getRequestContext(c);
    const { id } = c.req.valid("param");
    if (!(await getWorkflow(db, c.get("session").user.id, id))) return c.json(notFound, 404);
    return c.json({ botIds: await botIdsOf(db, id) });
  })

  .put(
    "/:id/bots",
    userLimit,
    validate("param", idParam),
    validate("json", z.object({ botIds: z.array(z.string().min(1).max(64)).max(20) })),
    async (c) => {
      const { db } = getRequestContext(c);
      const userId = c.get("session").user.id;
      const { id } = c.req.valid("param");
      if (!(await getWorkflow(db, userId, id))) return c.json(notFound, 404);
      return c.json({ botIds: await setSharedBots(db, userId, id, c.req.valid("json").botIds) });
    },
  );

export default share;
