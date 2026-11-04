import { and, eq, gte, sql } from "drizzle-orm";
import type { PDFDocument } from "pdf-lib";
import type { Db } from "../../../db";
import { agentUsage } from "../../../db/schema";
import { parsePdf } from "./pdf-parse";
import { subset } from "./pdf-text";
import type { ReadOptions, StoredFile } from "./types";

/** One `agent_usage` row per OCR'd page, so deleting the file never resets the daily cap. */
export const OCR_USAGE_MODEL = "ocr:mistral-ocr";

/** Pages OCR'd today (UTC) for this user. */
export async function ocrPagesToday(db: Db, userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentUsage)
    .where(and(eq(agentUsage.userId, userId), eq(agentUsage.model, OCR_USAGE_MODEL), gte(agentUsage.createdAt, start)));
  return Number(row?.n ?? 0);
}

/**
 * Scanned pages through Mistral OCR ($0.002 a page), within today's cap; each page cached in R2. Returns the text
 * per page, and why the rest could not be read.
 */
export async function ocrPages(o: ReadOptions, file: StoredFile, pdf: PDFDocument, pages: number[]): Promise<{ texts: Map<number, string>; note: string }> {
  const texts = new Map<number, string>();
  if (pages.length === 0) return { texts, note: "" };
  if (o.ocr === "off") return { texts, note: "OCR is turned off on this server." };
  const left = Math.max(0, o.maxOcrPagesPerDay - (await ocrPagesToday(o.db, o.userId)));
  for (const page of pages.slice(0, left)) {
    const key = `${file.row.storageKey}.parsed/ocr-p${page}.txt`;
    const cached = await o.bucket.get(key);
    if (cached) {
      texts.set(page, await cached.text());
      continue;
    }
    const parsed = await parsePdf(o.apiKey, file.row.name, await subset(pdf, [page - 1]), "mistral-ocr");
    if (!parsed.ok) return { texts, note: `OCR failed: ${parsed.error}.` };
    const text = parsed.pages.join("\n").trim() || "(OCR found no text on this page)";
    await o.bucket.put(key, text);
    await o.db.insert(agentUsage).values({ userId: o.userId, threadId: o.usage.threadId, runId: o.usage.runId, model: OCR_USAGE_MODEL, inputTokens: 0, outputTokens: 0 });
    texts.set(page, text);
  }
  return { texts, note: pages.length > left ? `Today's OCR allowance (${o.maxOcrPagesPerDay} pages) is used up.` : "" };
}
