import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../../middleware/auth-guard";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { getRun, listRuns } from "../store/runs";
import answer from "./answer";
import crud from "./crud";
import lifecycle from "./lifecycle";
import { liveSocket, liveToken } from "./live";
import runs from "./runs";
import share from "./share";

/** Workflows (/api/v1/workflows): every route is for the signed-in user's own workflows only. */
const workflows = new Hono<AuthGuardEnv>()
  // The live socket checks its own signed token (a WebSocket cannot carry the session), so it comes first.
  .route("/", liveSocket)
  .use("*", authGuard)
  .route("/", liveToken)
  .get("/runs/:runId", validate("param", z.object({ runId: z.uuid() })), async (c) => {
    const { db } = getRequestContext(c);
    const run = await getRun(db, c.get("session").user.id, c.req.valid("param").runId);
    if (!run) return c.json({ error: "NOT_FOUND", message: "Run not found." }, 404);
    return c.json(run);
  })
  .get("/:id/runs", validate("param", z.object({ id: z.uuid() })), async (c) => {
    const { db } = getRequestContext(c);
    const items = await listRuns(db, c.get("session").user.id, c.req.valid("param").id);
    return c.json({ items });
  })
  .route("/", runs)
  .route("/", answer)
  .route("/", share)
  .route("/", lifecycle)
  .route("/", crud);

export default workflows;
