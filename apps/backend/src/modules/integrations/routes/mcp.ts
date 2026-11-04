import { Hono } from "hono";
import { and, asc, eq, ne } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { catalogMcp, MCP_CATALOG, publicMcp } from "../catalog/mcp";
import { decryptSecret, encryptSecret } from "../../../shared/secrets";
import { mcpSecretContext, testConnection } from "../../agent/mcp";
import { userMcpServer } from "../../../db/schema";
import { connectSchema, hintOf, pick, secretsSchema, unavailable } from "./mcp-input";

const mcp = new Hono<AuthGuardEnv>()
  .get("/mcp", async (c) => {
    const { db } = getRequestContext(c);
    const rows = await db
      .select({ id: userMcpServer.id, serverId: userMcpServer.serverId, secretHint: userMcpServer.secretHint, hasSecrets: ne(userMcpServer.secrets, ""), createdAt: userMcpServer.createdAt, updatedAt: userMcpServer.updatedAt })
      .from(userMcpServer)
      .where(eq(userMcpServer.userId, c.get("session").user.id))
      .orderBy(asc(userMcpServer.createdAt));
    const byId = new Map(rows.map((r) => [r.serverId, r]));
    c.header("Cache-Control", "no-store");
    return c.json({
      catalog: MCP_CATALOG.map((s) => ({ ...publicMcp(s), connectedId: byId.get(s.id)?.id ?? null })),
      installed: rows.flatMap((r) => {
        const entry = catalogMcp(r.serverId);
        return entry ? [{ id: r.id, serverId: r.serverId, name: entry.name, summary: entry.summary, kind: entry.kind, secretHint: r.secretHint, needsSecrets: entry.fields.length > 0, createdAt: r.createdAt, updatedAt: r.updatedAt }] : [];
      }),
    });
  })

  // Connect: the token is checked against the server first, then encrypted before it is stored.
  .post("/mcp", userLimit, validate("json", connectSchema), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { serverId, secrets = {} } = c.req.valid("json");
    const entry = catalogMcp(serverId);
    if (!entry) return c.json({ error: "NOT_FOUND", message: "Unknown app." }, 404);
    const missing = entry.fields.filter((f) => !secrets[f.key]);
    if (missing.length) return c.json({ error: "INVALID_INPUT", message: `${missing.map((f) => f.label).join(", ")} is required.` }, 400);
    const clean = pick(entry, secrets);

    const check = await testConnection(entry, clean);
    if (!check.ok) return c.json({ error: "CONNECTION_FAILED", message: check.message }, 400);

    const [existing] = await db.select({ id: userMcpServer.id }).from(userMcpServer).where(and(eq(userMcpServer.userId, userId), eq(userMcpServer.serverId, serverId))).limit(1);
    const id = existing?.id ?? crypto.randomUUID();
    try {
      const sealed = entry.fields.length ? await encryptSecret(env, JSON.stringify(clean), mcpSecretContext(userId, id)) : null;
      const hint = hintOf(entry, clean);
      await db
        .insert(userMcpServer)
        .values({ id, userId, serverId, secrets: sealed, secretHint: hint })
        .onConflictDoUpdate({ target: [userMcpServer.userId, userMcpServer.serverId], set: { secrets: sealed, secretHint: hint } });
    } catch (error) {
      return c.json(unavailable(error), 503);
    }
    return c.json({ id, tools: check.tools }, existing ? 200 : 201);
  })

  // Replace the token of a connected app (checked first, like connecting).
  .put("/mcp/:id/secrets", userLimit, validate("json", secretsSchema), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");
    const [row] = await db.select({ serverId: userMcpServer.serverId }).from(userMcpServer).where(and(eq(userMcpServer.id, id), eq(userMcpServer.userId, userId))).limit(1);
    const entry = row && catalogMcp(row.serverId);
    if (!entry) return c.json({ error: "NOT_FOUND" }, 404);
    const { secrets } = c.req.valid("json");
    if (entry.fields.some((f) => !secrets[f.key])) return c.json({ error: "INVALID_INPUT", message: "All fields are required." }, 400);
    const clean = pick(entry, secrets);
    const check = await testConnection(entry, clean);
    if (!check.ok) return c.json({ error: "CONNECTION_FAILED", message: check.message }, 400);
    try {
      await db
        .update(userMcpServer)
        .set({ secrets: await encryptSecret(env, JSON.stringify(clean), mcpSecretContext(userId, id)), secretHint: hintOf(entry, clean) })
        .where(and(eq(userMcpServer.id, id), eq(userMcpServer.userId, userId)));
    } catch (error) {
      return c.json(unavailable(error), 503);
    }
    return c.json({ ok: true, tools: check.tools });
  })

  // Test a connected app with its saved token: a real call to the app (testConnection), nothing is changed.
  .post("/mcp/:id/test", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");
    const [row] = await db
      .select({ serverId: userMcpServer.serverId, secrets: userMcpServer.secrets })
      .from(userMcpServer)
      .where(and(eq(userMcpServer.id, id), eq(userMcpServer.userId, userId)))
      .limit(1);
    const entry = row && catalogMcp(row.serverId);
    if (!entry) return c.json({ error: "NOT_FOUND" }, 404);
    let secrets: Record<string, string> = {};
    try {
      if (row.secrets) secrets = JSON.parse(await decryptSecret(env, row.secrets, mcpSecretContext(userId, id))) as Record<string, string>;
    } catch {
      return c.json({ ok: false, message: "The saved token could not be read. Replace it." });
    }
    return c.json(await testConnection(entry, secrets));
  })

  // Disconnect: the encrypted token is deleted and every bot loses the app.
  .delete("/mcp/:id", userLimit, async (c) => {
    const { db } = getRequestContext(c);
    const [row] = await db
      .delete(userMcpServer)
      .where(and(eq(userMcpServer.id, c.req.param("id")), eq(userMcpServer.userId, c.get("session").user.id)))
      .returning({ id: userMcpServer.id });
    return row ? c.json({ ok: true }) : c.json({ error: "NOT_FOUND" }, 404);
  });

export default mcp;
