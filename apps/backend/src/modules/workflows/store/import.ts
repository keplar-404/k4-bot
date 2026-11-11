import { z } from "zod";
import type { Db } from "../../../db";
import { MAX_PORTABLE_CHARS, PORTABLE_FORMAT, PORTABLE_VERSION, stripPrivate } from "../graph/portable";
import { graphSchema } from "../graph/schema";
import type { GraphIssue } from "../graph/structure";
import { structureIssues } from "../graph/validate";
import { getWorkflow, saveDraft, type WorkflowRow } from "./workflows";

/** Only what is used is read: `exportedAt`, `requires` and any unknown key are dropped by the schema. */
const portableDocument = z.object({
  format: z.literal(PORTABLE_FORMAT),
  version: z.literal(PORTABLE_VERSION),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(""),
  graph: graphSchema,
});

export type ImportResult =
  | { ok: true; row: WorkflowRow }
  | { ok: false; status: 404 | 409 | 413 | 422; error: string; message: string; issues?: GraphIssue[] };

/**
 * Replaces a workflow's draft with a k4-workflow document. Everything private to the file's author is stripped again
 * here (never trusted from the caller). One code path for the builder's Import and the workflow assistant.
 */
export async function importDocument(
  db: Db,
  userId: string,
  workflowId: string,
  raw: unknown,
  expectedUpdatedAt?: string,
): Promise<ImportResult> {
  if (JSON.stringify(raw ?? null).length > MAX_PORTABLE_CHARS) {
    return { ok: false, status: 413, error: "TOO_LARGE", message: "The file is too large (512 KB at most)." };
  }
  const parsed = portableDocument.safeParse(raw);
  if (!parsed.success) {
    const f = (raw ?? {}) as { format?: unknown; version?: unknown };
    const message =
      f.format !== PORTABLE_FORMAT
        ? "This is not a workflow file."
        : f.version !== PORTABLE_VERSION
          ? "This workflow file is from an unsupported version."
          : "The workflow file is not valid.";
    return { ok: false, status: 422, error: "INVALID_FILE", message };
  }

  const graph = stripPrivate(parsed.data.graph);
  const issues = structureIssues(graph);
  if (issues.length > 0) return { ok: false, status: 422, error: "INVALID_GRAPH", message: issues[0]!.message, issues };

  const { name, description } = parsed.data;
  const saved = await saveDraft(db, userId, workflowId, { name, description, graph }, expectedUpdatedAt);
  if (saved) return { ok: true, row: saved };
  if (!(await getWorkflow(db, userId, workflowId))) {
    return { ok: false, status: 404, error: "NOT_FOUND", message: "Workflow not found." };
  }
  return { ok: false, status: 409, error: "CONFLICT", message: "This workflow was changed in another tab. Reload, then import again." };
}
