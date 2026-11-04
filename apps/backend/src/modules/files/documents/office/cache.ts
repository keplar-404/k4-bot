import type { ChatFile } from "../../../../db/schema";

/** R2 cache key for the converted markdown of an Office document. */
export const cacheKey = (file: { row: ChatFile }) => `${file.row.storageKey}.parsed/office.md`;

export async function readCache(bucket: R2Bucket, file: { row: ChatFile }): Promise<string | null> {
  const cached = await bucket.get(cacheKey(file));
  return cached ? await cached.text() : null;
}

export async function writeCache(bucket: R2Bucket, file: { row: ChatFile }, markdown: string): Promise<void> {
  await bucket.put(cacheKey(file), markdown, { httpMetadata: { contentType: "text/markdown" } });
}