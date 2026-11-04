import type { Db } from "../../../db";
import type { ChatFile } from "../../../db/schema";

/** What read_document needs from the run: storage, keys, the model's abilities and the OCR policy. */
export interface ReadOptions {
  bucket: R2Bucket;
  db: Db;
  userId: string;
  apiKey: string;
  /** Workers AI: converts Office documents (absent when the binding is not configured). */
  ai?: Ai;
  /** The model can look at pictures: scanned pages and figures are shown to it. */
  vision: boolean;
  /** At most this many pictures go to the model per call. */
  maxImages: number;
  ocr: "mistral-ocr" | "off";
  maxOcrPagesPerDay: number;
  /** Ids for the usage row of OCR'd pages. */
  usage: { threadId: string; runId: string };
}

export interface ReadResult {
  text: string;
  images: Array<{ name: string; mimeType: string; bytes: Uint8Array }>;
}

export type StoredFile = { row: ChatFile; bytes: Uint8Array };

/** What the bot asked for: "3", "2-5", "1,4,7-9" (empty = from the start), and whether to see the pictures. */
export type ReadRequest = { pages?: string; images?: boolean };

export const notDone = (text: string): ReadResult => ({ text: `NOT DONE: ${text}`, images: [] });
