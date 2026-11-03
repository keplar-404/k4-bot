import { DurableObject } from "cloudflare:workers";
import type { Sandbox } from "@e2b/desktop";
import { parseEnv, type Env } from "../../../config/env";
import type { ComputerState as State, Owner } from "../types";
import { type Core, TICK_MS } from "./constants";
import { ComputerTables } from "./tables";

/**
 * The first layer of the user's computer: what it remembers. Fields live here so every layer can use them; the
 * persisted part (`Core`) is restored after an eviction. Later layers add status, power, the lease and the bots' work.
 */
export class ComputerState extends DurableObject<Env> {
  protected sbx?: Sandbox;
  protected starting?: Promise<Sandbox>;
  protected gui: Promise<unknown> = Promise.resolve();
  protected botUsers = new Set<string>();
  protected vncFor?: string;
  protected hardenedFor?: string;
  protected execInFlight = 0;
  protected recentActions: number[] = [];
  /** Last time each bot was written to `workers` (the write is throttled: a busy bot acts every second or two). */
  protected marked = new Map<string, number>();
  protected runActions = new Map<string, number>();
  protected lastDriver?: string;
  protected readonly tables: ComputerTables;

  protected state: State = "off";
  protected lease: { owner: Owner; until: number } | null = null;
  protected lastActivity = 0;
  protected lastTick = 0;
  protected expiresAt = 0;
  protected message?: string;
  /** The current session: it ends at `sessionEndsAt`, the user is warned `COMPUTER_WRAP_MINUTES` before. */
  protected sessionEndsAt = 0;
  protected warned = false;
  protected wrapping = false;
  protected snapshotAt?: number;
  /** True while `pause` runs: calls that fail meanwhile failed because the computer is going to sleep. */
  protected pausing = false;
  /** Set by the sign-up provisioning alarm; any real wake-up clears it, so the computer is not put back to sleep. */
  protected provisionOnly = false;
  /** /home/BOTS.md is out of date (a bot was added, renamed or removed). */
  protected directoryDirty = true;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.tables = new ComputerTables(ctx.storage.sql);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Core>("core");
      if (!saved) return;
      // After eviction we have no sandbox object, but we know its id and that it was running: it stays
      // "running" so the alarm keeps metering and pausing it, and the next call reconnects to it.
      this.state = saved.state;
      this.message = saved.message;
      this.expiresAt = saved.expiresAt;
      this.lastActivity = saved.lastActivity;
      this.sessionEndsAt = saved.sessionEndsAt ?? 0;
      this.warned = saved.warned ?? false;
      this.wrapping = saved.wrapping ?? false;
      this.snapshotAt = saved.snapshotAt;
      this.lastTick = Date.now();
      if (saved.state === "running") void ctx.storage.getAlarm().then((at) => (at ? undefined : ctx.storage.setAlarm(Date.now() + TICK_MS)));
    });
  }

  protected get cfg() {
    return parseEnv(this.env);
  }

  protected async persist() {
    await this.ctx.storage.put("core", {
      state: this.state,
      message: this.message,
      expiresAt: this.expiresAt,
      lastActivity: this.lastActivity,
      sessionEndsAt: this.sessionEndsAt,
      warned: this.warned,
      wrapping: this.wrapping,
      snapshotAt: this.snapshotAt,
    } satisfies Core);
  }

  /** Who holds the mouse and keyboard right now, if anyone. */
  protected holder(): Owner | null {
    return this.lease && this.lease.until > Date.now() ? this.lease.owner : null;
  }

  protected touch() {
    this.lastActivity = Date.now();
  }
}
