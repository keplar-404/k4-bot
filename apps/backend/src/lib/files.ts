import { and, eq, gte, like, sql } from "drizzle-orm";
import type { FileRef } from "../agent/parts";
import type { Db } from "../db";
import { agentUsage, chatFile, type ChatFile } from "../db/schema";

/**
 * One file is at most this big: uploads, created images, and files copied to or from the computer
 * (those cross a Durable Object call, whose messages are capped at 32 MiB).
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Shown in the browser (chat previews). Everything else, SVG included (it can carry script), is a download. */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/** A name that is safe in a header, a shell path and a marker line: no folders, control characters or quotes. */
export function safeName(name: string, fallback = "file"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(/[\u0000-\u001f\u007f"'`$\\]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return clean || fallback;
}

export function typeOf(name: string, given?: string | null): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (TYPES[ext]) return TYPES[ext];
  return given && /^[\w.+-]+\/[\w.+-]+$/.test(given) ? given : "application/octet-stream";
}

export const extensionFor = (mimeType: string) => EXTENSIONS[mimeType] ?? "png";

export const isInline = (mimeType: string) => INLINE_TYPES.has(mimeType);

export const toRef = (row: Pick<ChatFile, "id" | "name" | "mimeType" | "size" | "source">): FileRef => ({
  id: row.id,
  name: row.name,
  mimeType: row.mimeType,
  size: row.size,
  source: row.source as FileRef["source"],
});

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

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

/**
 * Every created image is also an `agent_usage` row (model "image:<id>"). Those rows stay when the file is
 * deleted, so deleting images never hands back today's allowance.
 */
export const IMAGE_USAGE_PREFIX = "image:";

/** Images created today (UTC) by any of the user's bots. */
export async function imagesToday(db: Db, userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentUsage)
    .where(and(eq(agentUsage.userId, userId), like(agentUsage.model, `${IMAGE_USAGE_PREFIX}%`), gte(agentUsage.createdAt, start)));
  return Number(row?.n ?? 0);
}
