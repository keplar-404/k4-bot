import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { catalogSkill, SKILL_CATALOG } from "../catalog/skills";
import { fetchSkill, installSkill, SkillSourceError, skillFrontmatter } from "../skills";
import { userSkill } from "../../../db/schema";

const skillIdSchema = z.object({ skillId: z.string().min(3).max(200) });

const unavailable = (error: unknown) => {
  if (error instanceof SkillSourceError) return { error: "UNAVAILABLE", message: error.message } as const;
  throw error;
};

const skills = new Hono<AuthGuardEnv>()
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
      return c.json(unavailable(error), 502);
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
      return c.json({ id: await installSkill(db, env.FILES, userId, skillId) }, 201);
    } catch (error) {
      return c.json(unavailable(error), 502);
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
  });

export default skills;
