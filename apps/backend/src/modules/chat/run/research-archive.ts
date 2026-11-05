import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { researchTask } from "../../../db/schema";
import type { ResearchArchive } from "../../agent/tools/web/research-archive";
import { loadFile, saveFile, toRef } from "../../files";

/**
 * /deep-research tasks in Postgres (research_task, one row per thread and request) and reports in the user's file
 * store (R2 + chat_file, like any file a bot creates). Without a bucket, tasks are still tracked and reports are only
 * in the conversation.
 */
export function pgResearchArchive(o: { db: Db; bucket?: R2Bucket; userId: string; threadId: string; botId: string; maxStorageBytes: number }): ResearchArchive {
  const { db, userId, threadId } = o;
  const row = (key: string) => and(eq(researchTask.threadId, threadId), eq(researchTask.inputHash, key));
  return {
    async find(key) {
      const [r] = await db.select().from(researchTask).where(row(key)).limit(1);
      return r ? { requestId: r.requestId, status: r.status, fileId: r.fileId } : null;
    },
    async start(key, requestId) {
      await db
        .insert(researchTask)
        .values({ threadId, inputHash: key, userId, requestId, status: "pending" })
        .onConflictDoUpdate({ target: [researchTask.threadId, researchTask.inputHash], set: { requestId, status: "pending", fileId: null, updatedAt: sql`now()` } });
    },
    async finish(key, status, fileId) {
      await db.update(researchTask).set({ status, fileId: fileId ?? null, updatedAt: sql`now()` }).where(row(key));
    },
    async saveReport(name, markdown) {
      if (!o.bucket) return "file storage is not set up";
      return saveFile(o.bucket, db, { maxStorageBytes: o.maxStorageBytes }, { userId, botId: o.botId, threadId, source: "generated", name, mimeType: "text/markdown", bytes: new TextEncoder().encode(markdown) });
    },
    async loadReport(fileId) {
      if (!o.bucket) return null;
      const f = await loadFile(o.bucket, db, userId, fileId);
      return f ? { file: toRef(f.row), markdown: new TextDecoder().decode(f.bytes) } : null;
    },
  };
}
