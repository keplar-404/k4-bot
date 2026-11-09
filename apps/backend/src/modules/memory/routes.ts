import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { undoMemoryEvent } from "./auto/undo";
import { loadMemory, MAX_BOT_MEMORY, MAX_PREFERENCES, saveBotMemory, savePreferences } from "./store";

/** The user views and edits what their bots remember: the global preferences and each bot's own memory. */
const memory = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/preferences", async (c) => {
    const { db } = getRequestContext(c);
    const { preferences } = await loadMemory(db, c.get("session").user.id, "");
    c.header("Cache-Control", "no-store");
    return c.json({ content: preferences, max: MAX_PREFERENCES });
  })
  .put("/preferences", userLimit, validate("json", z.object({ content: z.string().max(MAX_PREFERENCES) })), async (c) => {
    const { db } = getRequestContext(c);
    const { content } = c.req.valid("json");
    await savePreferences(db, c.get("session").user.id, content.trim());
    return c.json({ content: content.trim(), max: MAX_PREFERENCES });
  })
  .get("/bots/:id", async (c) => {
    const { db } = getRequestContext(c);
    const { memory } = await loadMemory(db, c.get("session").user.id, c.req.param("id"));
    c.header("Cache-Control", "no-store");
    return c.json({ content: memory, max: MAX_BOT_MEMORY });
  })
  .put("/bots/:id", userLimit, validate("json", z.object({ content: z.string().max(MAX_BOT_MEMORY) })), async (c) => {
    const { db } = getRequestContext(c);
    const { content } = c.req.valid("json");
    const saved = await saveBotMemory(db, c.get("session").user.id, c.req.param("id"), content.trim());
    if (!saved) return c.json({ error: "NOT_FOUND" }, 404);
    return c.json({ content: content.trim(), max: MAX_BOT_MEMORY });
  })
  // Undo of an automatic update (the "Memory updated" notice in the chat).
  .post("/events/:id/undo", userLimit, validate("param", z.object({ id: z.uuid() })), async (c) => {
    const { db } = getRequestContext(c);
    const result = await undoMemoryEvent(db, c.get("session").user.id, c.req.valid("param").id);
    if (result === "not_found") return c.json({ error: "NOT_FOUND", message: "Nothing to undo." }, 404);
    if (result === "changed") return c.json({ error: "CHANGED", message: "The memory changed since; edit it instead." }, 409);
    return c.json({ ok: true });
  });

export default memory;
