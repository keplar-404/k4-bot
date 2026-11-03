import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import { botSkill, userSkill } from "../db/schema";
import { catalogSkill } from "./catalog/skills";

/**
 * skills.sh's public download endpoint, the one its own CLI (`npx skills add`) uses: the skill's files plus a
 * content hash. (The documented /api/v1 API needs a Vercel OIDC token, which only Vercel deployments have.)
 */
const SKILLS_SH = "https://skills.sh";

/** Limits on what one skill may bring in. Office skills ship ~1 MB of XML schemas, so 3 MB leaves room. */
const MAX_SKILL_BYTES = 3 * 1024 * 1024;
const MAX_SKILL_FILES = 300;

export type SkillFile = { path: string; contents: string };
export type SkillSnapshot = { files: SkillFile[]; hash: string | null };

export class SkillSourceError extends Error {}

/** A relative path that stays inside the skill folder. */
const safePath = (path: string) =>
  path.length > 0 && path.length <= 300 && !path.startsWith("/") && !path.includes("\\") && !path.split("/").some((p) => p === ".." || p === "." || p === "");

/** Fetches a catalog skill's files from skills.sh, cached at the edge for 5 minutes (skills.sh's own cache window). */
export async function fetchSkill(skillId: string): Promise<SkillSnapshot> {
  if (!catalogSkill(skillId)) throw new SkillSourceError("Unknown skill.");
  const [owner, repo, slug] = skillId.split("/");
  const url = `${SKILLS_SH}/api/download/${encodeURIComponent(owner!)}/${encodeURIComponent(repo!)}/${encodeURIComponent(slug!)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit);
  if (!response.ok) throw new SkillSourceError(`skills.sh answered ${response.status} for this skill.`);
  const body = (await response.json().catch(() => null)) as { files?: unknown; hash?: unknown } | null;
  if (!body || !Array.isArray(body.files)) throw new SkillSourceError("skills.sh returned no files for this skill.");

  const files: SkillFile[] = [];
  let size = 0;
  for (const f of body.files as Array<{ path?: unknown; contents?: unknown }>) {
    if (typeof f.path !== "string" || typeof f.contents !== "string" || !safePath(f.path)) continue;
    size += f.contents.length;
    files.push({ path: f.path, contents: f.contents });
  }
  if (!files.some((f) => f.path === "SKILL.md")) throw new SkillSourceError("This skill has no SKILL.md.");
  if (files.length > MAX_SKILL_FILES || size > MAX_SKILL_BYTES) throw new SkillSourceError("This skill is too large to install.");
  return { files, hash: typeof body.hash === "string" ? body.hash : null };
}

/** The SKILL.md frontmatter fields the platform needs. */
export function skillFrontmatter(markdown: string): { name: string; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  const field = (key: string) => {
    const line = match?.[1]?.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
    return (line?.slice(key.length + 1).trim() ?? "").replace(/^["']|["']$/g, "");
  };
  return { name: field("name"), description: field("description") };
}

/** A folder name for the agent: the skill's own name when it is spec-shaped (lowercase, digits, hyphens). */
export function skillFolder(name: string, skillId: string): string {
  const clean = name.toLowerCase().trim();
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean) && clean.length <= 64) return clean;
  return (skillId.split("/").pop() ?? "skill").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 64);
}

const sha256 = async (text: string) => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).toString("hex");

/** Stores the snapshot once per distinct content (users installing the same version share it). */
export async function storeSnapshot(bucket: R2Bucket, snapshot: SkillSnapshot): Promise<{ storageKey: string; size: number }> {
  const body = JSON.stringify({ files: snapshot.files });
  const storageKey = `skills/${await sha256(body)}.json`;
  if (!(await bucket.head(storageKey))) await bucket.put(storageKey, body, { httpMetadata: { contentType: "application/json" } });
  return { storageKey, size: body.length };
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
