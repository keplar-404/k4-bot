import type { ActivityEvent, WorkingBot } from "../types";
import { ACTIVITY_KEEP, BUSY_MS } from "./constants";

/**
 * The Durable Object's own SQLite database: survives evictions and restarts.
 *  activity:     what the bots did on the computer (shown in the panel);
 *  bots:         names of the bots that have an account here (for /home/BOTS.md);
 *  workers:      bots using the computer in a run that has not ended (cleared when its slice ends);
 *  removed_bots: deleted bots. Their account is purged now if the computer is awake, otherwise on
 *                its next wake, and a run still in flight can never use the computer again.
 */
export class ComputerTables {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS activity (at INTEGER NOT NULL, bot_id TEXT NOT NULL, text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bots (bot_id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS removed_bots (bot_id TEXT PRIMARY KEY, purged INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS workers (bot_id TEXT PRIMARY KEY, last_touch INTEGER NOT NULL);
    `);
  }

  /** Bots that used the computer a moment ago and whose run has not ended (`except` leaves one out). */
  working(except?: string): WorkingBot[] {
    return this.sql
      .exec<{ botId: string; name: string }>(
        `SELECT w.bot_id AS botId, COALESCE(b.name, 'A bot') AS name FROM workers w LEFT JOIN bots b ON b.bot_id = w.bot_id
         WHERE w.last_touch > ? AND w.bot_id <> ? ORDER BY w.last_touch DESC`,
        Date.now() - BUSY_MS,
        except ?? "",
      )
      .toArray();
  }

  touchWorker(botId: string, at: number) {
    this.sql.exec("INSERT INTO workers (bot_id, last_touch) VALUES (?, ?) ON CONFLICT (bot_id) DO UPDATE SET last_touch = excluded.last_touch", botId, at);
  }

  removeWorker(botId: string) {
    this.sql.exec("DELETE FROM workers WHERE bot_id = ?", botId);
  }

  clearWorkers() {
    this.sql.exec("DELETE FROM workers");
  }

  isRemoved(botId: string) {
    return this.sql.exec("SELECT 1 FROM removed_bots WHERE bot_id = ?", botId).toArray().length > 0;
  }

  /** Records the bot's display name. Returns whether it changed. */
  nameBot(botId: string, name: string): boolean {
    const [row] = this.sql.exec<{ name: string }>("SELECT name FROM bots WHERE bot_id = ?", botId).toArray();
    if (row?.name === name) return false;
    this.sql.exec("INSERT INTO bots (bot_id, name) VALUES (?, ?) ON CONFLICT (bot_id) DO UPDATE SET name = excluded.name", botId, name);
    return true;
  }

  botNames() {
    return this.sql.exec<{ bot_id: string; name: string }>("SELECT bot_id, name FROM bots ORDER BY name").toArray();
  }

  removeBot(botId: string) {
    this.sql.exec("INSERT INTO removed_bots (bot_id) VALUES (?) ON CONFLICT (bot_id) DO NOTHING", botId);
    this.sql.exec("DELETE FROM bots WHERE bot_id = ?", botId);
    this.sql.exec("DELETE FROM activity WHERE bot_id = ?", botId);
  }

  pendingPurges() {
    return this.sql.exec<{ bot_id: string }>("SELECT bot_id FROM removed_bots WHERE purged = 0").toArray();
  }

  markPurged(botId?: string) {
    if (botId) this.sql.exec("UPDATE removed_bots SET purged = 1 WHERE bot_id = ?", botId);
    // A fresh disk has no accounts, so nothing of a deleted bot is left to purge.
    else this.sql.exec("UPDATE removed_bots SET purged = 1");
  }

  addActivity(event: ActivityEvent) {
    this.sql.exec("INSERT INTO activity (at, bot_id, text) VALUES (?, ?, ?)", event.at, event.botId, event.text);
    this.sql.exec("DELETE FROM activity WHERE rowid <= (SELECT MAX(rowid) FROM activity) - ?", ACTIVITY_KEEP);
  }

  clearActivity() {
    this.sql.exec("DELETE FROM activity");
  }

  recentActivity(limit = 30): ActivityEvent[] {
    return this.sql
      .exec<{ at: number; botId: string; text: string }>("SELECT at, bot_id AS botId, text FROM activity ORDER BY rowid DESC LIMIT ?", limit)
      .toArray()
      .reverse();
  }
}
