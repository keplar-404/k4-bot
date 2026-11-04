import { PDFDocument } from "pdf-lib";
import { parsePdf } from "./pdf-parse";
import type { ReadOptions, StoredFile } from "./types";

/** Pages parsed per request (and per cached piece): small enough for any free model's context. */
export const CHUNK = 20;

/** One cached piece of CHUNK pages (index k): parsed once with the free engine, then read from R2. */
export async function chunkText(o: ReadOptions, file: StoredFile, pdf: PDFDocument, k: number, total: number) {
  const key = `${file.row.storageKey}.parsed/c${k}.json`;
  const cached = await o.bucket.get(key);
  if (cached) return { ok: true as const, pages: (await cached.json<{ pages: string[] }>()).pages };
  const from = k * CHUNK;
  const count = Math.min(CHUNK, total - from);
  const piece = total <= CHUNK ? file.bytes : await subset(pdf, Array.from({ length: count }, (_, i) => from + i));
  const parsed = await parsePdf(o.apiKey, file.row.name, piece, "cloudflare-ai");
  if (!parsed.ok) return parsed;
  // A parser that merged pages still yields text; pad or trim to the piece's page count so numbering holds.
  const pages = Array.from({ length: count }, (_, i) => parsed.pages[i] ?? "");
  if (parsed.pages.length > count) pages[count - 1] += `\n${parsed.pages.slice(count).join("\n")}`;
  await o.bucket.put(key, JSON.stringify({ pages }), { httpMetadata: { contentType: "application/json" } });
  return { ok: true as const, pages };
}

/** A new PDF of the given 0-based pages, to parse a piece of a long document. */
export async function subset(pdf: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const page of await out.copyPages(pdf, indices)) out.addPage(page);
  return out.save();
}
