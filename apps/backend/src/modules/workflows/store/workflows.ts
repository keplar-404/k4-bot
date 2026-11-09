import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { workflow } from "../../../db/schema";
import type { WorkflowGraph } from "../graph/schema";

/** Per-user caps: how many workflows can exist, and how many can be on at once. */
export const MAX_WORKFLOWS = 100;
export const MAX_ACTIVE = 25;

export type WorkflowRow = typeof workflow.$inferSelect;

/** The trigger block a new workflow starts with, so the canvas is never empty. */
export const STARTER_GRAPH: WorkflowGraph = {
  nodes: [{ id: "trigger", kind: "trigger.manual", position: { x: 0, y: 0 }, config: { fields: [] } }],
  edges: [],
};

/** Every query goes through the owner: a workflow id alone never reaches another user's data. */
const owned = (userId: string, id: string) => and(eq(workflow.id, id), eq(workflow.userId, userId));

export async function listWorkflows(db: Db, userId: string) {
  return db
    .select()
    .from(workflow)
    .where(eq(workflow.userId, userId))
    .orderBy(desc(workflow.updatedAt))
    .limit(MAX_WORKFLOWS);
}

export async function getWorkflow(db: Db, userId: string, id: string): Promise<WorkflowRow | null> {
  const [row] = await db.select().from(workflow).where(owned(userId, id)).limit(1);
  return row ?? null;
}

export async function countWorkflows(db: Db, userId: string, status?: "active") {
  const [row] = await db
    .select({ n: count() })
    .from(workflow)
    .where(status ? and(eq(workflow.userId, userId), eq(workflow.status, status)) : eq(workflow.userId, userId));
  return row?.n ?? 0;
}

export async function createWorkflow(db: Db, userId: string, name: string, graph: WorkflowGraph = STARTER_GRAPH) {
  const [row] = await db.insert(workflow).values({ id: crypto.randomUUID(), userId, name, graph }).returning();
  return row!;
}

/**
 * Saves the draft. `expectedUpdatedAt` makes the save conditional (optimistic concurrency): a second tab that saved in
 * between makes this one fail instead of silently overwriting it. Returns null on a conflict or a missing workflow.
 */
export async function saveDraft(
  db: Db,
  userId: string,
  id: string,
  patch: { name?: string; description?: string; graph?: WorkflowGraph },
  expectedUpdatedAt?: string,
) {
  const where = expectedUpdatedAt
    ? and(owned(userId, id), sql`date_trunc('milliseconds', ${workflow.updatedAt}) = ${expectedUpdatedAt}::timestamp`)
    : owned(userId, id);
  const [row] = await db
    .update(workflow)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(where)
    .returning();
  return row ?? null;
}

export async function setStatus(db: Db, userId: string, id: string, values: Partial<typeof workflow.$inferInsert>) {
  const [row] = await db
    .update(workflow)
    .set({ ...values, updatedAt: sql`now()` })
    .where(owned(userId, id))
    .returning();
  return row ?? null;
}

export async function deleteWorkflow(db: Db, userId: string, id: string) {
  const rows = await db.delete(workflow).where(owned(userId, id)).returning({ id: workflow.id });
  return rows.length > 0;
}

/** For the public webhook route only, where there is no signed-in user: the token proves access, not the session. */
export async function getWorkflowForHook(db: Db, id: string): Promise<WorkflowRow | null> {
  const [row] = await db.select().from(workflow).where(eq(workflow.id, id)).limit(1);
  return row ?? null;
}
