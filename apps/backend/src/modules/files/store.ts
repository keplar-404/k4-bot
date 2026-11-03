import { and, eq, sql } from "drizzle-orm";
import type { FileRef } from "../agent/parts";
import type { Db } from "../../db";
import { chatFile, type ChatFile } from "../../db/schema";
import { formatBytes, MAX_FILE_BYTES, safeName, typeOf } from "./mime";

export const toRef = (row: Pick<ChatFile, "id" | "name" | "mimeType" | "size" | "source">): FileRef => ({
  id: row.id,
  name: row.name,
  mimeType: row.mimeType,
  size: row.size,
  source: row.source as FileRef["source"],
});

export class FileStoreError extends Error {}

/** Stores the bytes in R2 and records them, after checking the user's storage allowance. */
export async function saveFile(
  bucket: R2Bucket,
  db: Db,
  limits: { maxStorageBytes: number },
  file: {
    userId: string;
    botId?: string | null;
    threadId?: string | null;
    source: FileRef["source"];
    name: string;
    mimeType?: string | null;
    bytes: Uint8Array | ArrayBuffer;
    computerPath?: string | null;
    prompt?: string | null;
  },
): Promise<FileRef> {
  const size = file.bytes.byteLength;
  if (size > MAX_FILE_BYTES) throw new FileStoreError(`The file is ${formatBytes(size)}; the limit is ${formatBytes(MAX_FILE_BYTES)}.`);
  const [used] = await db
    .select({ total: sql<number>`coalesce(sum(${chatFile.size}), 0)::bigint` })
    .from(chatFile)
    .where(eq(chatFile.userId, file.userId));
  if (Number(used?.total ?? 0) + size > limits.maxStorageBytes) {
    throw new FileStoreError(`File storage is full (${formatBytes(limits.maxStorageBytes)}). Delete files on the Files page to make room.`);
  }

  const id = crypto.randomUUID();
  const name = safeName(file.name);
  const mimeType = typeOf(name, file.mimeType);
  // Keyed by user, so one user's objects can be listed or removed together.
  const storageKey = `u/${file.userId}/${id}`;
  await bucket.put(storageKey, file.bytes, { httpMetadata: { contentType: mimeType } });
  const [row] = await db
    .insert(chatFile)
    .values({
      id,
      userId: file.userId,
      botId: file.botId ?? null,
      threadId: file.threadId ?? null,
      source: file.source,
      name,
      mimeType,
      size,
      storageKey,
      computerPath: file.computerPath ?? null,
      prompt: file.prompt ?? null,
    })
    .returning();
  return toRef(row!);
}

/** The user's own file, with its bytes. Null when it is not theirs or is gone. */
export async function loadFile(bucket: R2Bucket, db: Db, userId: string, id: string): Promise<{ row: ChatFile; bytes: Uint8Array } | null> {
  const row = await ownedFile(db, userId, id);
  if (!row) return null;
  const object = await bucket.get(row.storageKey);
  if (!object) return null;
  return { row, bytes: new Uint8Array(await object.arrayBuffer()) };
}

export async function ownedFile(db: Db, userId: string, id: string): Promise<ChatFile | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db
    .select()
    .from(chatFile)
    .where(and(eq(chatFile.id, id), eq(chatFile.userId, userId)))
    .limit(1);
  return row ?? null;
}
