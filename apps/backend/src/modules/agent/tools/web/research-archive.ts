import type { FileRef } from "../../parts";

/** One research request as saved: the paid Tavily task and, once done, the report file. */
export type SavedResearch = { requestId: string; status: "pending" | "completed" | "failed"; fileId: string | null };

/**
 * Where /deep-research keeps its tasks and reports (chat/run/research-archive.ts on Postgres + R2; memory in tests).
 * `key` identifies one request in one thread: the same question with the same options.
 */
export interface ResearchArchive {
  find(key: string): Promise<SavedResearch | null>;
  /** Records a started task before it is polled. Replaces an earlier failed or expired task of the same key. */
  start(key: string, requestId: string): Promise<void>;
  finish(key: string, status: "completed" | "failed", fileId?: string): Promise<void>;
  /** Saves the full report as a file for the user; a string is the reason it could not be saved. */
  saveReport(name: string, markdown: string): Promise<FileRef | string>;
  /** A saved report, or null when its file is gone. */
  loadReport(fileId: string): Promise<{ file: FileRef; markdown: string } | null>;
}

/** sha-256 of the research arguments, so a retried tool call (same arguments from the checkpoint) finds its task. */
export async function researchKey(args: object): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(args, Object.keys(args).sort()));
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
}

/** In-memory archive with the same rules, for the CLI and the checks. */
export function memoryResearchArchive(): ResearchArchive & { files: Map<string, { file: FileRef; markdown: string }> } {
  const rows = new Map<string, SavedResearch>();
  const files = new Map<string, { file: FileRef; markdown: string }>();
  return {
    files,
    find: async (key) => rows.get(key) ?? null,
    start: async (key, requestId) => void rows.set(key, { requestId, status: "pending", fileId: null }),
    finish: async (key, status, fileId) => {
      const row = rows.get(key);
      if (row) rows.set(key, { ...row, status, fileId: fileId ?? null });
    },
    saveReport: async (name, markdown) => {
      const file: FileRef = { id: crypto.randomUUID(), name, mimeType: "text/markdown", size: markdown.length, source: "generated" };
      files.set(file.id, { file, markdown });
      return file;
    },
    loadReport: async (fileId) => files.get(fileId) ?? null,
  };
}
