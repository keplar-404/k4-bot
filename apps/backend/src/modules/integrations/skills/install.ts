import type { Db } from "../../../db";
import { userSkill } from "../../../db/schema";
import { catalogSkill } from "../catalog/skills";
import { fetchSkill, skillFrontmatter, storeSnapshot } from "./source";

/** Installs a catalog skill for the user: a pinned snapshot of its files, stored once per distinct content. */
export async function installSkill(db: Db, bucket: R2Bucket, userId: string, skillId: string): Promise<string | undefined> {
  const snapshot = await fetchSkill(skillId);
  const front = skillFrontmatter(snapshot.files.find((f) => f.path === "SKILL.md")!.contents);
  const { storageKey, size } = await storeSnapshot(bucket, snapshot);
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
  return row?.id;
}
