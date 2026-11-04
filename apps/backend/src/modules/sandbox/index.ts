import { TICK_MS } from "./constants";
import { pauseCoding } from "./e2b";
import { SandboxEditor } from "./editor";
import { addUsage, shouldPause } from "./policy";
import * as store from "./store";

/**
 * A bot's code sandbox, one per bot (named by bot id). Called over Durable Object RPC (sandbox-backend.ts).
 * The alarm meters running time against the user's daily cap and pauses the sandbox once nobody uses it.
 * It is never deleted by itself: only the user, or a bot with the user's approval.
 */
export class BotSandbox extends SandboxEditor {
  async alarm() {
    if (this.state !== "running" || !this.userId) return;
    const cfg = this.cfg;
    const now = Date.now();
    const row = await store.getForBot(this.db, this.userId, this.botId);
    const usage = addUsage(row?.usageDay ? { day: row.usageDay, seconds: row.usageSeconds } : null, this.lastTick || now, now, TICK_MS);
    this.lastTick = now;
    await store.update(this.db, this.userId, this.botId, { usageDay: usage.day, usageSeconds: Math.round(usage.seconds), lastActivityAt: new Date(this.lastActivity) });
    const overCap = (await store.secondsToday(this.db, this.userId)) >= cfg.SANDBOX_MAX_MINUTES_PER_DAY * 60;
    const idle = shouldPause({ working: this.working, editorOpen: this.editorOpen, idleMs: now - this.lastActivity, limitMs: cfg.SANDBOX_IDLE_MINUTES * 60_000 });
    if (overCap || idle) {
      await this.pause(this.userId);
      return;
    }
    // Keep E2B's own timeout ahead of real use.
    await this.sbx?.setTimeout(15 * 60_000).catch(() => undefined);
    await this.persist();
    await this.ctx.storage.setAlarm(now + TICK_MS);
  }

  /** What the panel shows, readable without calling E2B. */
  async info(userId: string) {
    if (!this.owns(userId)) return null;
    return { state: this.state, sandboxId: this.sbxId ?? null, working: this.working, lastActivity: this.lastActivity };
  }

  /** Cron safety net: a sandbox whose alarm was lost is paused by id. */
  async pauseIfStale(userId: string) {
    if (this.state === "running" && !this.working) await this.pause(userId);
    else if (this.sbxId && this.state !== "running") await pauseCoding(this.sbxId, this.cfg.E2B_API_KEY).catch(() => undefined);
  }
}
