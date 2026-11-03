import { and, eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { botSkill, userSkill } from "../../../db/schema";
import { safePath, type SkillFile } from "./source";

/** A folder name for the agent: the skill's own name when it is spec-shaped (lowercase, digits, hyphens). */
export function skillFolder(name: string, skillId: string): string {
  const clean = name.toLowerCase().trim();
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean) && clean.length <= 64) return clean;
  return (skillId.split("/").pop() ?? "skill").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 64);
}

/**
 * The skills assigned to a bot, as files for the agent: "/<folder>/SKILL.md", "/<folder>/scripts/x.py", ...
 * Read from R2 (no third-party call during a run).
 */
export async function loadBotSkills(bucket: R2Bucket, db: Db, userId: string, botId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({ name: userSkill.name, skillId: userSkill.skillId, storageKey: userSkill.storageKey })
    .from(botSkill)
    .innerJoin(userSkill, eq(userSkill.id, botSkill.userSkillId))
    .where(and(eq(botSkill.botId, botId), eq(userSkill.userId, userId)));
  return loadSkillFiles(bucket, rows);
}

export type InstalledSkillRef = { name: string; skillId: string; storageKey: string };

/** Installed skills as agent files ("/<folder>/SKILL.md", ...), read from R2: used for bots and their sub-agents. */
export async function loadSkillFiles(bucket: R2Bucket, rows: InstalledSkillRef[]): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const used = new Set<string>();
  for (const row of rows) {
    const object = await bucket.get(row.storageKey);
    if (!object) continue;
    const { files: list } = (await object.json()) as { files: SkillFile[] };
    let folder = skillFolder(row.name, row.skillId);
    while (used.has(folder)) folder = `${folder}-2`;
    used.add(folder);
    for (const f of list) if (safePath(f.path)) files[`/${folder}/${f.path}`] = f.contents;
  }
  return files;
}
