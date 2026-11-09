import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Env } from "../../config/env";
import { composioEvent } from "../../db/schema";
import { getRequestContext } from "../../shared/context";
import { pauseForExpiredAccount } from "./auto-pause";
import { startListeningWorkflows } from "./event-runs";
import { verifyEvent } from "./verify-event";

/**
 * POST /api/v1/composio/events: where Composio delivers app events (a Slack message, a new email…) for the whole
 * project. There is no session: the signature (COMPOSIO_WEBHOOK_SECRET) proves the request is Composio's. Delivery is
 * at least once, so each event id is remembered and a redelivery starts nothing. Every workflow that is on and listens
 * on that trigger instance, for that same user, gets a run. An expired connection turns off the workflows using it.
 */
const composioEvents = new Hono<{ Bindings: Env }>().post("/", async (c) => {
  const { db, env } = getRequestContext(c);
  if (!env.COMPOSIO_WEBHOOK_SECRET) return c.json({ error: "NOT_CONFIGURED" }, 503);

  const body = await c.req.text();
  const headers = {
    id: c.req.header("webhook-id") ?? "",
    timestamp: c.req.header("webhook-timestamp") ?? "",
    signature: c.req.header("webhook-signature") ?? "",
  };
  const verified = await verifyEvent(env, env.COMPOSIO_WEBHOOK_SECRET, headers, body);
  if (!verified) return c.json({ error: "INVALID_SIGNATURE" }, 401);
  const { eventId, trigger: event, expired } = verified;
  // Any other project event is not used.
  if (!event && !expired) return c.json({ ok: true, ignored: true });
  if (!eventId) return c.json({ error: "NO_EVENT_ID" }, 400);

  const [fresh] = await db.insert(composioEvent).values({ id: eventId }).onConflictDoNothing().returning();
  if (!fresh) return c.json({ ok: true, duplicate: true });

  try {
    if (expired) return c.json({ ok: true, paused: await pauseForExpiredAccount(env, db, expired) });
    const started = await startListeningWorkflows(env, db, event!, eventId);
    return c.json({ ok: true, started });
  } catch (error) {
    // Forget the event so Composio's retry can try again: nothing was started for it.
    console.error("[composio-events] could not start runs", eventId, error);
    await db.delete(composioEvent).where(eq(composioEvent.id, eventId));
    return c.json({ error: "SERVER_ERROR" }, 500);
  }
});

export default composioEvents;
