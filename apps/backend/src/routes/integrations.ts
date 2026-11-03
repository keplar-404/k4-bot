import { Hono } from "hono";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getRequestContext } from "../lib/context";
import { validate } from "../lib/validate";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { userLimit } from "../middleware/rate-limit";
import { catalogSkill, SKILL_CATALOG } from "../lib/catalog/skills";
import { catalogMcp, MCP_CATALOG, publicMcp } from "../lib/catalog/mcp";
import { fetchSkill, SkillSourceError, skillFrontmatter, storeSnapshot } from "../lib/skills";
import { encryptSecret, secretHint, SecretsUnavailableError } from "../lib/secrets";
import { mcpSecretContext, testConnection } from "../agent/mcp";
import { userMcpServer, userSkill } from "../db/schema";

const skillIdSchema = z.object({ skillId: z.string().min(3).max(200) });
const connectSchema = z.object({
  serverId: z.string().min(1).max(40),
  secrets: z.record(z.string().max(40), z.string().trim().min(1).max(4000)).optional(),
});
const secretsSchema = z.object({ secrets: z.record(z.string().max(40), z.string().trim().min(1).max(4000)) });

/**
 * Skills and connected apps (MCP servers) of the signed-in user. Secrets go in (encrypted at once) and never come
 * back out: responses only say whether a secret is saved and its last characters.
 */
const integrations = new Hono<AuthGuardEnv>()
  .use("*", authGuard)

  // ------------------------------------------------------------------ skills

  .get("/skills", async (c) => {
    const { db } = getRequestContext(c);
    const installed = await db
      .select({ id: userSkill.id, skillId: userSkill.skillId, name: userSkill.name, description: userSkill.description, installedAt: userSkill.installedAt })
      .from(userSkill)
      .where(eq(userSkill.userId, c.get("session").user.id))
      .orderBy(asc(userSkill.installedAt));
    const byId = new Map(installed.map((s) => [s.skillId, s]));
    c.header("Cache-Control", "no-store");
    return c.json({
      catalog: SKILL_CATALOG.map((s) => ({ ...s, installedId: byId.get(s.id)?.id ?? null })),
      installed: installed.map((s) => ({ ...s, role: catalogSkill(s.skillId)?.role ?? null, title: catalogSkill(s.skillId)?.name ?? s.name })),
    });
  })

  // A skill's full details for the details page: its SKILL.md and the list of its other files.
  .get("/skills/details", validate("query", skillIdSchema), async (c) => {
    const { skillId } = c.req.valid("query");
    const entry = catalogSkill(skillId);
    if (!entry) return c.json({ error: "NOT_FOUND" }, 404);
    try {
      const snapshot = await fetchSkill(skillId);
      const skillMd = snapshot.files.find((f) => f.path === "SKILL.md")!.contents;
      const front = skillFrontmatter(skillMd);
      c.header("Cache-Control", "private, max-age=300");
      return c.json({
        skill: {
          ...entry,
          description: front.description || entry.summary,
          source: skillId.split("/").slice(0, 2).join("/"),
          url: `https://skills.sh/${skillId}`,
          skillMd,
          files: snapshot.files.map((f) => ({ path: f.path, size: f.contents.length })),
        },
      });
    } catch (error) {
      if (error instanceof SkillSourceError) return c.json({ error: "UNAVAILABLE", message: error.message }, 502);
      throw error;
    }
  })

  // Install: a pinned snapshot of the skill's files, stored once per distinct content.
  .post("/skills", userLimit, validate("json", skillIdSchema), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillId } = c.req.valid("json");
    if (!catalogSkill(skillId)) return c.json({ error: "NOT_FOUND", message: "Unknown skill." }, 404);
    if (!env.FILES) return c.json({ error: "UNAVAILABLE", message: "File storage is not configured." }, 503);
    const [existing] = await db.select({ id: userSkill.id }).from(userSkill).where(and(eq(userSkill.userId, userId), eq(userSkill.skillId, skillId))).limit(1);
    if (existing) return c.json({ id: existing.id }, 200);
    try {
      const snapshot = await fetchSkill(skillId);
      const front = skillFrontmatter(snapshot.files.find((f) => f.path === "SKILL.md")!.contents);
      const { storageKey, size } = await storeSnapshot(env.FILES, snapshot);
      const [row] = await db
        .insert(userSkill)
        .values({
          id: crypto.randomUUID(),
          userId,
          skillId,
          name: (front.name || skillId.split("/").pop()!).slice(0, 64),
          description: (front.description || catalogSkill(skillId)!.summary).slice(0, 1024),
          hash: snapshot.hash,
          storageKey,
          fileCount: snapshot.files.length,
          size,
        })
        .onConflictDoNothing()
        .returning({ id: userSkill.id });
      return c.json({ id: row?.id }, 201);
    } catch (error) {
      if (error instanceof SkillSourceError) return c.json({ error: "UNAVAILABLE", message: error.message }, 502);
      throw error;
    }
  })

  // Uninstall: also removes it from every bot. The stored snapshot goes when no other install uses it.
  .delete("/skills/:id", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const [row] = await db
      .delete(userSkill)
      .where(and(eq(userSkill.id, c.req.param("id")), eq(userSkill.userId, c.get("session").user.id)))
      .returning({ storageKey: userSkill.storageKey });
    if (!row) return c.json({ error: "NOT_FOUND" }, 404);
    const [shared] = await db.select({ id: userSkill.id }).from(userSkill).where(eq(userSkill.storageKey, row.storageKey)).limit(1);
    if (!shared) await env.FILES?.delete(row.storageKey).catch(() => undefined);
    return c.json({ ok: true });
  })

  // ------------------------------------------------------------------ MCP servers

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
    const clean = Object.fromEntries(entry.fields.map((f) => [f.key, secrets[f.key]!]));

    const check = await testConnection(entry, clean);
    if (!check.ok) return c.json({ error: "CONNECTION_FAILED", message: check.message }, 400);

    const [existing] = await db.select({ id: userMcpServer.id }).from(userMcpServer).where(and(eq(userMcpServer.userId, userId), eq(userMcpServer.serverId, serverId))).limit(1);
    const id = existing?.id ?? crypto.randomUUID();
    try {
      const sealed = entry.fields.length ? await encryptSecret(env, JSON.stringify(clean), mcpSecretContext(userId, id)) : null;
      const hint = entry.fields[0] ? secretHint(clean[entry.fields[0].key]!) : null;
      await db
        .insert(userMcpServer)
        .values({ id, userId, serverId, secrets: sealed, secretHint: hint })
        .onConflictDoUpdate({ target: [userMcpServer.userId, userMcpServer.serverId], set: { secrets: sealed, secretHint: hint } });
    } catch (error) {
      if (error instanceof SecretsUnavailableError) return c.json({ error: "UNAVAILABLE", message: error.message }, 503);
      throw error;
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
    const clean = Object.fromEntries(entry.fields.map((f) => [f.key, secrets[f.key]!]));
    const check = await testConnection(entry, clean);
    if (!check.ok) return c.json({ error: "CONNECTION_FAILED", message: check.message }, 400);
    try {
      await db
        .update(userMcpServer)
        .set({ secrets: await encryptSecret(env, JSON.stringify(clean), mcpSecretContext(userId, id)), secretHint: entry.fields[0] ? secretHint(clean[entry.fields[0].key]!) : null })
        .where(and(eq(userMcpServer.id, id), eq(userMcpServer.userId, userId)));
    } catch (error) {
      if (error instanceof SecretsUnavailableError) return c.json({ error: "UNAVAILABLE", message: error.message }, 503);
      throw error;
    }
    return c.json({ ok: true, tools: check.tools });
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

export default integrations;
