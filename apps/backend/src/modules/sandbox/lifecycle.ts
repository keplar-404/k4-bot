import type { Sandbox } from "e2b";
import { fail, type Result } from "./constants";
import { connectCoding, createCodingSandbox, killCoding, pauseCoding } from "./e2b";
import { SandboxStateDO } from "./state";
import * as store from "./store";

/** Starting, resuming, pausing and deleting the bot's one sandbox, within the user's limits. */
export class SandboxLifecycle extends SandboxStateDO {
  /** Resumes the bot's sandbox, or creates it when it has none (checked against the user's count and daily minutes). */
  async ensure(userId: string, purpose: string): Promise<Result<{ sandboxId: string; created: boolean }>> {
    if (!this.owns(userId)) return fail("this sandbox belongs to another user");
    const cfg = this.cfg;
    if (!cfg.E2B_API_KEY) return fail("sandboxes are not configured on this server (E2B_API_KEY)");
    if ((await store.secondsToday(this.db, userId)) >= cfg.SANDBOX_MAX_MINUTES_PER_DAY * 60) {
      return fail(`today's sandbox time (${cfg.SANDBOX_MAX_MINUTES_PER_DAY} min) is used up; it resets at 00:00 UTC`);
    }
    const row = await store.getForBot(this.db, userId, this.botId);
    const resumed = row ? await connectCoding(row.sandboxId, cfg.E2B_API_KEY) : undefined;
    if (row && resumed) return this.started(userId, resumed, false);
    if (row) await store.remove(this.db, userId, this.botId); // E2B no longer has it: start over

    const count = await store.countForUser(this.db, userId);
    if (count >= cfg.SANDBOX_MAX_PER_USER) {
      return fail(`you already have ${count} sandboxes (limit ${cfg.SANDBOX_MAX_PER_USER}); ask the user to delete one first`);
    }
    this.state = "creating";
    const sbx = await createCodingSandbox(cfg, { userId, botId: this.botId });
    try {
      await store.create(this.db, { botId: this.botId, userId, sandboxId: sbx.sandboxId, purpose: purpose.slice(0, 300), template: cfg.SANDBOX_TEMPLATE });
    } catch (error) {
      await killCoding(sbx.sandboxId, cfg.E2B_API_KEY); // never leave a paid sandbox without its record
      this.state = "none";
      return fail(`could not record the sandbox (${error instanceof Error ? error.message : String(error)})`);
    }
    return this.started(userId, sbx, true);
  }

  private async started(userId: string, sbx: Sandbox, created: boolean): Promise<Result<{ sandboxId: string; created: boolean }>> {
    this.sbx = sbx;
    this.sbxId = sbx.sandboxId;
    this.userId = userId;
    this.state = "running";
    this.markWorking();
    this.lastTick = Date.now();
    await store.update(this.db, userId, this.botId, { status: "running", lastUsedAt: new Date(), lastActivityAt: new Date() });
    await this.persist();
    await this.scheduleAlarm();
    return { ok: true, value: { sandboxId: sbx.sandboxId, created } };
  }

  /** The running sandbox, resumed when paused; refuses when the bot has none yet. */
  protected async live(): Promise<Result<Sandbox>> {
    if (this.sbx && this.state === "running") return { ok: true, value: this.sbx };
    if (!this.userId || !this.sbxId) return fail("this bot has no sandbox yet; call sandbox_start first");
    const r = await this.ensure(this.userId, "resumed");
    return r.ok ? { ok: true, value: this.sbx! } : r;
  }

  /** Sleeps the sandbox (files kept, billing stops). Safe when already paused. */
  async pause(userId: string): Promise<Result<null>> {
    if (!this.owns(userId)) return fail("this sandbox belongs to another user");
    if (this.sbxId && this.state === "running") await pauseCoding(this.sbxId, this.cfg.E2B_API_KEY).catch(() => undefined);
    this.sbx = undefined;
    if (this.state === "running") this.state = "paused";
    if (this.userId) await store.update(this.db, this.userId, this.botId, { status: "paused" });
    await this.persist();
    return { ok: true, value: null };
  }

  /** Deletes the sandbox in E2B and here; its record goes too. */
  async destroy(userId: string): Promise<Result<null>> {
    if (!this.owns(userId)) return fail("this sandbox belongs to another user");
    if (this.sbxId) await killCoding(this.sbxId, this.cfg.E2B_API_KEY);
    await store.remove(this.db, userId, this.botId);
    this.sbx = undefined;
    this.sbxId = undefined;
    this.state = "none";
    await this.ctx.storage.deleteAll();
    return { ok: true, value: null };
  }
}
