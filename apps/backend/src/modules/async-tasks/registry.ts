import { DurableObject } from "cloudflare:workers";
import type { Env } from "../../config/env";

export type TaskStatus = "running" | "success" | "error" | "cancelled";
export type TaskRow = {
  id: string;
  agent: string;
  description: string;
  status: TaskStatus;
  result: string | null;
  instance: string;
  created_at: number;
  updated_at: number;
  /** The parent was told it ended (its notice middleware), so it is not told twice. */
  notified: number;
};

/**
 * The background tasks of one chat thread (named by thread id). Task state lives here, not in the parent's messages,
 * so a summary of the conversation never loses a task id (as Deep Agents keeps them in a separate state channel).
 */
export class AsyncTaskRegistry extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, agent TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL,
        result TEXT, instance TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, notified INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS inbox (task_id TEXT NOT NULL, message TEXT NOT NULL, at INTEGER NOT NULL);
    `);
  }

  private rows(where = "1=1", ...args: unknown[]) {
    return this.ctx.storage.sql.exec<TaskRow>(`SELECT * FROM tasks WHERE ${where} ORDER BY created_at`, ...args).toArray();
  }

  create(t: { id: string; agent: string; description: string; instance: string }) {
    const now = Date.now();
    this.ctx.storage.sql.exec("INSERT INTO tasks (id, agent, description, status, instance, created_at, updated_at) VALUES (?, ?, ?, 'running', ?, ?, ?)", t.id, t.agent, t.description, t.instance, now, now);
  }

  get(id: string): TaskRow | null {
    return this.rows("id = ?", id)[0] ?? null;
  }

  list(): TaskRow[] {
    return this.rows();
  }

  running(): number {
    return this.rows("status = 'running'").length;
  }

  /** Ends a task once; a later end (a cancelled task's workflow still finishing) does not overwrite it. */
  finish(id: string, status: Exclude<TaskStatus, "running">, result: string) {
    this.ctx.storage.sql.exec("UPDATE tasks SET status = ?, result = ?, updated_at = ?, notified = 0 WHERE id = ? AND status = 'running'", status, result, Date.now(), id);
  }

  /** A follow-up for a running task: delivered before its next model call. A finished task is restarted instead. */
  push(id: string, message: string) {
    this.ctx.storage.sql.exec("INSERT INTO inbox (task_id, message, at) VALUES (?, ?, ?)", id, message, Date.now());
  }

  take(id: string): string[] {
    const msgs = this.ctx.storage.sql.exec<{ message: string }>("SELECT message FROM inbox WHERE task_id = ? ORDER BY at", id).toArray();
    this.ctx.storage.sql.exec("DELETE FROM inbox WHERE task_id = ?", id);
    return msgs.map((m) => m.message);
  }

  restart(id: string, instance: string) {
    this.ctx.storage.sql.exec("UPDATE tasks SET status = 'running', instance = ?, updated_at = ?, notified = 0 WHERE id = ?", instance, Date.now(), id);
  }

  /** Ended tasks the parent has not been told about; marks them told. */
  unseen(): TaskRow[] {
    const rows = this.rows("status <> 'running' AND notified = 0");
    this.ctx.storage.sql.exec("UPDATE tasks SET notified = 1 WHERE status <> 'running'");
    return rows;
  }

  /** The thread was deleted: its tasks go too. */
  async purge() {
    await this.ctx.storage.deleteAll();
  }
}
