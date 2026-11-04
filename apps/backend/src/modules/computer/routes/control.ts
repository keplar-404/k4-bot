import { Hono } from "hono";
import { z } from "zod";
import { computerFor } from "../sandbox-backend";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { stopBotRuns } from "../../chat/cleanup";
import { computerSettingsSchema } from "../types";

const message = (error: unknown) => (error instanceof Error ? error.message : "The computer is unavailable.");

const control = new Hono<AuthGuardEnv>()
  .get("/", async (c) => {
    const { env } = getRequestContext(c);
    return c.json(await computerFor(env, c.get("session").user.id).status());
  })

  // Wakes (or creates) the computer. Quota is checked inside; this is the only call that can start billing.
  .post("/wake", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    const stub = computerFor(env, c.get("session").user.id);
    try {
      await stub.ensure();
    } catch (error) {
      return c.json({ error: "COMPUTER_UNAVAILABLE", message: message(error) }, 409);
    }
    return c.json(await stub.status());
  })

  // Sleeps the computer. While bots are working it does nothing unless `force` is set, and answers 409 with
  // who is working so the page can ask first; forced, those bots are told it was shut down and stop.
  .post("/pause", userLimit, validate("json", z.object({ force: z.boolean().optional() }).default({})), async (c) => {
    const { env } = getRequestContext(c);
    const stub = computerFor(env, c.get("session").user.id);
    const result = await stub.close({ reason: "Paused by you. Your work is saved.", cause: "user", force: c.req.valid("json").force === true });
    if (!result.closed) return c.json({ error: "BOTS_WORKING", message: "Bots are using the computer.", working: result.working }, 409);
    return c.json(await stub.status());
  })

  // Wipes the computer to a brand-new one. Same rule as /pause: 409 with who is working unless `force`;
  // forced, those bots' runs are stopped.
  .post("/reset", userLimit, validate("json", z.object({ force: z.boolean().optional() }).default({})), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const stub = computerFor(env, userId);
    let result: Awaited<ReturnType<typeof stub.reset>>;
    try {
      result = await stub.reset(c.req.valid("json").force === true);
    } catch (error) {
      return c.json({ error: "COMPUTER_UNAVAILABLE", message: message(error) }, 409);
    }
    if (!result.reset) return c.json({ error: "BOTS_WORKING", message: "Bots are using the computer.", working: result.working }, 409);
    await stopBotRuns(db, env, userId, result.stopped.map((b) => b.botId), "Stopped: you reset the computer while this bot was working.");
    return c.json(await stub.status());
  })

  .get("/settings", async (c) => {
    const { env } = getRequestContext(c);
    return c.json(await computerFor(env, c.get("session").user.id).settings());
  })
  .put("/settings", userLimit, validate("json", computerSettingsSchema), async (c) => {
    const { env } = getRequestContext(c);
    return c.json(await computerFor(env, c.get("session").user.id).saveSettings(c.req.valid("json")));
  })

  // The session is ending: tell the bots to finish and summarise; the computer sleeps a little later.
  .post("/session/wrap", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    const stub = computerFor(env, c.get("session").user.id);
    await stub.wrapUp();
    return c.json(await stub.status());
  })

  // The screen saved when the computer last went to sleep. Read from Durable Object storage: no E2B call.
  .get("/snapshot", async (c) => {
    const { env } = getRequestContext(c);
    const shot = await computerFor(env, c.get("session").user.id).snapshot();
    if (!shot) return c.body(null, 404);
    return c.body(shot.png as Uint8Array<ArrayBuffer>, 200, {
      "content-type": "image/png",
      // The client asks with ?at=<snapshotAt>, so a new screen is a new URL.
      "cache-control": "private, max-age=86400",
    });
  })

  // The user takes the mouse and keyboard; bots are told to wait. `keep` is the heartbeat while in control.
  .post("/control/take", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    try {
      const result = await computerFor(env, c.get("session").user.id).takeControl();
      return c.json(result, result.ok ? 200 : 409);
    } catch (error) {
      return c.json({ error: "COMPUTER_UNAVAILABLE", message: message(error) }, 409);
    }
  })
  .post("/control/keep", async (c) => {
    const { env } = getRequestContext(c);
    return c.json({ held: await computerFor(env, c.get("session").user.id).keepControl() });
  })
  .post("/control/release", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    await computerFor(env, c.get("session").user.id).releaseControl();
    return c.json({ ok: true });
  });

export default control;
