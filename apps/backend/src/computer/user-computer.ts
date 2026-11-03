import { DurableObject } from "cloudflare:workers";
import { CommandExitError, NotFoundError, Sandbox } from "@e2b/desktop";
import { parseEnv, type Env } from "../lib/env";
import {
  DENY_OUT,
  botHome,
  botUnixUser,
  checkKeys,
  checkTypedText,
  checkUrl,
  parseAllowedHosts,
  shellQuote,
} from "./guards";
import {
  SCREEN,
  computerActionSchema,
  type ActionResult,
  type ActivityEvent,
  type ComputerAction,
  type ComputerState,
  type ComputerStatus,
  type ExecResult,
  type Owner,
  type WorkingBot,
} from "./types";

/** E2B sandbox timeout. Extended while there is activity; on expiry E2B pauses (never kills) the computer. */
const SESSION_MS = 10 * 60_000;
const EXTEND_WHEN_BELOW_MS = 3 * 60_000;
/** A bot keeps the mouse and keyboard this long after its last action, so a crashed run cannot block others. */
const BOT_LEASE_MS = 45_000;
const USER_LEASE_MS = 5 * 60_000;
const TICK_MS = 30_000;
const ACTIONS_PER_MINUTE = 90;
const MAX_PARALLEL_EXEC = 4;
const MAX_OUTPUT_CHARS = 30_000;
/** A bot counts as "using the computer" this long after its last shell, file or screen action (and until its run ends). */
const BUSY_MS = 3 * 60_000;
/** How long a bot is still told that the computer was shut down under it (a later, unrelated run is not). */
const CLOSED_TTL_MS = 30 * 60_000;
/** The tick while bots are wrapping up: the computer sleeps as soon as the last one is done. */
const WRAP_TICK_MS = 10_000;
/** Waking needs at least this much of today's computer time left: booting for a few seconds of use is waste. */
const MIN_WAKE_SECONDS = 60;

/** Our own VNC servers. 5911/6091 is read-only (enforced by x11vnc itself), 5912/6092 is interactive. */
type Ports = { vnc: number; web: number };
const VIEW: Ports = { vnc: 5911, web: 6091 };
const CONTROL: Ports = { vnc: 5912, web: 6092 };

const SETTLE_MS: Record<ComputerAction["action"], number> = {
  screenshot: 0,
  mouse_move: 200,
  left_click: 700,
  right_click: 700,
  middle_click: 700,
  double_click: 700,
  left_click_drag: 700,
  type: 400,
  key: 600,
  scroll: 500,
  wait: 0,
  open_url: 2500,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Date().toISOString().slice(0, 10);
const cap = (s: string) => (s.length > MAX_OUTPUT_CHARS ? `${s.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]` : s);
/** The saved screen must fit one Durable Object storage value (2 MiB). */
const MAX_SNAPSHOT_BYTES = 1_900_000;
const ACTIVITY_KEEP = 200;
const STAGE_DIR = "/var/lib/k4-stage";
/** Per bot account, across all of its commands and its browser. */
const BOT_MAX_PROCESSES = 2048;

/**
 * Run as root once per computer, before any bot uses it. Bots are ordinary Linux users with no sudo
 * rights; this closes what is left:
 *  - the desktop's own account (/home/user) is not readable by bots;
 *  - bots cannot see other users' processes or their command lines (hidepid);
 *  - root has no usable password, so `su` cannot become root.
 * Every step is idempotent and best effort: a template without one of these just skips it.
 */
const HARDEN = [
  "chmod 750 /home/user",
  "mount -o remount,hidepid=2 /proc",
  "passwd -l root",
].map((c) => `${c} >/dev/null 2>&1`).join("; ") + "; true";

/** What is persisted across evictions. */
type Core = {
  state: ComputerState;
  message?: string;
  expiresAt: number;
  lastActivity: number;
  sessionEndsAt?: number;
  warned?: boolean;
  wrapping?: boolean;
  snapshotAt?: number;
};

/**
 * The computer was shut down while these bots were working. Each is told on its next model call (and by
 * the error of any computer tool), so it stops and writes a final message instead of trying again.
 */
type Closed = {
  cause: "user" | "quota" | "session";
  at: number;
  bots: Record<string, { name: string; told: boolean }>;
};

/** Thrown to the agent's tools when the computer is not on. Agents never wake it by themselves. */
class ComputerOffError extends Error {}

/**
 * One E2B desktop per user, shared by all of that user's bots.
 *
 * Why a Durable Object: it is the single place that knows whether the
 * computer is awake, who holds the mouse, and how many minutes were used
 * today, and it serialises everything that must not interleave. State lives
 * in DO storage, so nothing here calls E2B just to answer a status question.
 *
 * How bots stay out of each other's way:
 *  - files/shell: each bot is its own Linux user with a private (700) home;
 *  - browser:    each bot gets its own Chrome profile and window class;
 *  - mouse/keys: one lease, held per bot while it works, and the user can take it.
 */
export class UserComputerDurableObject extends DurableObject<Env> {
  private sbx?: Sandbox;
  private starting?: Promise<Sandbox>;
  private gui: Promise<unknown> = Promise.resolve();
  private botUsers = new Set<string>();
  private vncFor?: string;
  private hardenedFor?: string;
  private execInFlight = 0;
  private recentActions: number[] = [];
  /** Last time each bot was written to `workers` (the write is throttled: a busy bot acts every second or two). */
  private marked = new Map<string, number>();
  private runActions = new Map<string, number>();
  private lastDriver?: string;

  private state: ComputerState = "off";
  private lease: { owner: Owner; until: number } | null = null;
  private lastActivity = 0;
  private lastTick = 0;
  private expiresAt = 0;
  private message?: string;
  /** The current session: it ends at `sessionEndsAt`, the user is warned `COMPUTER_WRAP_MINUTES` before. */
  private sessionEndsAt = 0;
  private warned = false;
  private wrapping = false;
  private snapshotAt?: number;
  /** True while `pause` runs: calls that fail meanwhile failed because the computer is going to sleep. */
  private pausing = false;
  /** Set by the sign-up provisioning alarm; any real wake-up clears it, so the computer is not put back to sleep. */
  private provisionOnly = false;
  /** /home/BOTS.md is out of date (a bot was added, renamed or removed). */
  private directoryDirty = true;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // This object's own SQLite database: survives evictions and restarts.
    //  activity:     what the bots did on the computer (shown in the panel);
    //  bots:         names of the bots that have an account here (for /home/BOTS.md);
    //  workers:      bots using the computer in a run that has not ended (cleared when its slice ends);
    //  removed_bots: deleted bots. Their account is purged now if the computer is awake, otherwise on
    //                its next wake, and a run still in flight can never use the computer again.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS activity (at INTEGER NOT NULL, bot_id TEXT NOT NULL, text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bots (bot_id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS removed_bots (bot_id TEXT PRIMARY KEY, purged INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS workers (bot_id TEXT PRIMARY KEY, last_touch INTEGER NOT NULL);
    `);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Core>("core");
      if (saved) {
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
      }
    });
  }

  private get cfg() {
    return parseEnv(this.env);
  }

  // ---------------------------------------------------------------- status

  private async usedSeconds(): Promise<number> {
    const u = await this.ctx.storage.get<{ day: string; seconds: number }>("usage");
    return u?.day === today() ? u.seconds : 0;
  }

  private get wrapMs() {
    return this.cfg.COMPUTER_WRAP_MINUTES * 60_000;
  }

  /**
   * When the computer will go to sleep by itself: the end of this session or the moment today's computer
   * time runs out, whichever comes first. Usage is saved at every tick, so the quota end is exact.
   */
  private async endsAt(): Promise<{ at: number; reason: "session" | "quota" }> {
    const left = this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - (await this.usedSeconds());
    const quotaAt = this.lastTick + Math.max(0, left) * 1000;
    const sessionAt = this.sessionEndsAt || Number.POSITIVE_INFINITY;
    return quotaAt <= sessionAt ? { at: quotaAt, reason: "quota" } : { at: sessionAt, reason: "session" };
  }

  /** Bots that used the computer a moment ago and whose run has not ended (`except` leaves one out). */
  private working(except?: string): WorkingBot[] {
    return this.ctx.storage.sql
      .exec<{ botId: string; name: string }>(
        `SELECT w.bot_id AS botId, COALESCE(b.name, 'A bot') AS name FROM workers w LEFT JOIN bots b ON b.bot_id = w.bot_id
         WHERE w.last_touch > ? AND w.bot_id <> ? ORDER BY w.last_touch DESC`,
        Date.now() - BUSY_MS,
        except ?? "",
      )
      .toArray();
  }

  /** Called on every shell, file or screen action of a bot. Storage only: never touches E2B. */
  private markWorking(botId: string) {
    const now = Date.now();
    if (now - (this.marked.get(botId) ?? 0) < 15_000) return;
    this.marked.set(botId, now);
    this.ctx.storage.sql.exec(
      "INSERT INTO workers (bot_id, last_touch) VALUES (?, ?) ON CONFLICT (bot_id) DO UPDATE SET last_touch = excluded.last_touch",
      botId,
      now,
    );
  }

  async status(): Promise<ComputerStatus> {
    const now = Date.now();
    const used = await this.usedSeconds();
    const end = this.state === "running" ? await this.endsAt() : null;
    return {
      state: this.state,
      lease: this.lease && this.lease.until > now ? this.lease.owner : null,
      minutesUsedToday: Math.round(used / 60),
      minutesLimit: this.cfg.COMPUTER_MAX_MINUTES_PER_DAY,
      limitReached: this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - used < MIN_WAKE_SECONDS,
      working: this.state === "running" ? this.working() : [],
      message: this.message,
      session: end
        ? {
            endsInMs: Math.max(0, end.at - now),
            warning: this.warned || end.at - now <= this.wrapMs,
            wrapping: this.wrapping,
            reason: end.reason,
          }
        : undefined,
      snapshotAt: this.snapshotAt,
      updatedAt: now,
    };
  }

  private async persist() {
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

  /** The screen saved when the computer last went to sleep, for the asleep preview. */
  async snapshot(): Promise<{ at: number; png: Uint8Array } | null> {
    return (await this.ctx.storage.get<{ at: number; png: Uint8Array }>("snapshot")) ?? null;
  }

  private async publishStatus() {
    this.broadcast({ type: "status", status: await this.status() });
  }

  private async setState(state: ComputerState, message?: string) {
    this.state = state;
    this.message = message;
    await this.persist();
    await this.publishStatus();
  }

  // ---------------------------------------------------------------- lifecycle

  private assertEnabled() {
    const cfg = this.cfg;
    if (!cfg.COMPUTER_ENABLED) throw new Error("The computer feature is turned off.");
    if (!cfg.E2B_API_KEY) throw new Error("The computer is not configured on this server.");
  }

  /** A running computer may use its last second; waking it needs a minute left (MIN_WAKE_SECONDS). */
  private async assertQuota() {
    const left = this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - (await this.usedSeconds());
    if (left <= 0 || (this.state !== "running" && left < MIN_WAKE_SECONDS)) {
      throw new Error(`Daily computer time limit reached (${this.cfg.COMPUTER_MAX_MINUTES_PER_DAY} min). It resets at 00:00 UTC.`);
    }
  }

  /** Wakes or creates the computer. Idempotent; concurrent callers share one start. */
  async ensure(): Promise<void> {
    this.provisionOnly = false;
    await this.live();
  }

  /**
   * A new (verified) user gets their own fresh computer: created now, then put to sleep at once, so it
   * exists and their first wake-up is a quick resume. Runs in an alarm (retried by the platform if it
   * fails) so the sign-up request never waits on E2B. Never called for unverified sign-ups.
   */
  async provision(): Promise<void> {
    const cfg = this.cfg;
    if (!cfg.COMPUTER_ENABLED || !cfg.E2B_API_KEY) return;
    if (await this.ctx.storage.get<string>("sandboxId")) return;
    await this.ctx.storage.put("provision", true);
    await this.ctx.storage.setAlarm(Date.now());
  }

  /** If it throws, the flag stays and the platform retries the alarm (with backoff). */
  private async runProvisioning() {
    const needed = (this.state === "off" || this.state === "error") && !(await this.ctx.storage.get<string>("sandboxId"));
    if (needed) {
      this.provisionOnly = true;
      try {
        await this.live();
        if (this.provisionOnly) await this.pause("Your computer is ready. Wake it, or a bot asks you to when it needs it.");
      } finally {
        this.provisionOnly = false;
      }
    }
    await this.ctx.storage.delete("provision");
  }

  private async live(): Promise<Sandbox> {
    this.assertEnabled();
    await this.assertQuota();
    if (this.sbx && this.state === "running") return this.sbx;
    this.starting ??= this.start().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  private async start(): Promise<Sandbox> {
    const cfg = this.cfg;
    // After an eviction the computer is still running and we only lost the sandbox object:
    // reconnecting is free and must not restart the session clock.
    const reconnecting = this.state === "running";
    const startedAt = Date.now();
    if (!reconnecting) await this.setState("starting", "Waking your computer…");
    try {
      const apiKey = cfg.E2B_API_KEY;
      const id = await this.ctx.storage.get<string>("sandboxId");
      let sbx: Sandbox | undefined;

      if (id) {
        try {
          // connect() resumes a paused sandbox with its memory (open windows, running apps) intact.
          sbx = await Sandbox.connect(id, { apiKey, timeoutMs: SESSION_MS });
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
      }
      // One computer per user: if this object lost track of the user's computer (it crashed between creating
      // it and saving its id), find it by its metadata and use it instead of creating a second one.
      if (!sbx) {
        sbx = await this.findOwnSandbox(apiKey);
        if (sbx) {
          this.botUsers.clear();
          this.vncFor = undefined;
          this.directoryDirty = true;
          await this.ctx.storage.put("sandboxId", sbx.sandboxId);
        }
      }
      if (!sbx) {
        if (!reconnecting) await this.setState("starting", "Setting up a new computer…");
        const allowed = parseAllowedHosts(cfg.COMPUTER_ALLOWED_HOSTS);
        const network = {
          // Private to everyone but this Durable Object: reached only through our authenticated proxy.
          allowPublicTraffic: false,
          ...(allowed.length > 0
            ? { allowOut: allowed.flatMap((h) => [h, `*.${h}`]), denyOut: ["0.0.0.0/0"] }
            : { denyOut: DENY_OUT }),
        };
        const options = {
          apiKey,
          resolution: [SCREEN.width, SCREEN.height] as [number, number],
          dpi: 96,
          timeoutMs: SESSION_MS,
          // On timeout E2B pauses (memory kept, billing stops) instead of destroying the work.
          lifecycle: { onTimeout: "pause" as const, autoResume: false },
          network,
          // Lets an operator tell whose computer a sandbox is in the E2B console.
          metadata: { app: "k4-bot", userId: this.ctx.id.name ?? "unknown" },
        };
        sbx = cfg.E2B_TEMPLATE === "desktop" ? await Sandbox.create(options) : await Sandbox.create(cfg.E2B_TEMPLATE, options);
        this.botUsers.clear();
        this.vncFor = undefined;
        this.directoryDirty = true;
        // A fresh disk has no accounts, so nothing of a deleted bot is left to purge.
        this.ctx.storage.sql.exec("UPDATE removed_bots SET purged = 1");
        await this.ctx.storage.put("sandboxId", sbx.sandboxId);
      }

      this.sbx = sbx;
      await this.harden(sbx);
      // Bots deleted while the computer slept: remove their accounts and files before anyone can use it.
      await this.purgeRemovedBots(sbx).catch((e) => console.error("[computer] purge", e));
      if (!reconnecting) {
        const booted = Date.now();
        // Start the screen servers now, so the live preview connects the moment the computer is "running".
        await this.setState("starting", "Starting the screen…");
        await this.ensureVnc(sbx).catch((e) => console.error("[computer] vnc", e));
        const now = Date.now();
        console.log(`[computer] ${id === sbx.sandboxId ? "resumed" : "created"} in ${booted - startedAt}ms, screen ready in ${now - booted}ms`);
        this.expiresAt = now + SESSION_MS;
        this.lastActivity = now;
        this.lastTick = now;
        this.sessionEndsAt = now + cfg.COMPUTER_SESSION_MINUTES * 60_000;
        this.warned = false;
        this.wrapping = false;
        this.ctx.storage.sql.exec("DELETE FROM workers");
        this.marked.clear();
        await this.ctx.storage.delete("closed");
        await this.setState("running");
        await this.scheduleAlarm();
      }
      return sbx;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the computer.";
      await this.setState("error", message);
      throw new Error(message);
    }
  }

  /**
   * Pause keeps disk and memory and stops billing. Safe to call when already paused.
   * The screen is saved first, so the asleep preview shows where things were left.
   */
  async pause(reason = "Asleep. Your work is saved."): Promise<void> {
    this.pausing = true;
    try {
      await this.sleepNow(reason);
    } finally {
      this.pausing = false;
    }
  }

  private async sleepNow(reason: string) {
    const sbx = this.sbx;
    this.sbx = undefined;
    this.lease = null;
    this.vncFor = undefined;
    this.sessionEndsAt = 0;
    this.warned = false;
    this.wrapping = false;
    if (sbx) {
      const png = await sbx.screenshot().catch(() => undefined);
      if (png && png.byteLength <= MAX_SNAPSHOT_BYTES) {
        this.snapshotAt = Date.now();
        await this.ctx.storage.put("snapshot", { at: this.snapshotAt, png });
      }
    }
    // After an eviction there is no sandbox object, but the id is enough to pause it.
    const id = sbx?.sandboxId ?? (await this.ctx.storage.get<string>("sandboxId"));
    if (id) await Sandbox.pause(id, { apiKey: this.cfg.E2B_API_KEY }).catch(() => undefined);
    if (this.state === "running" || this.state === "starting") await this.setState("paused", reason);
  }

  /**
   * Shuts the computer down on someone's say-so. While bots are using it that needs `force`: without it nothing
   * happens and the bots are returned, so the caller can ask first (the server is the judge, not a possibly
   * stale screen). Forced, the bots are remembered so each is told it was shut down and writes a final message.
   * `exceptBotId` is the bot that asked for it (it knows).
   */
  async close(options: {
    reason: string;
    cause: Closed["cause"];
    force: boolean;
    exceptBotId?: string;
  }): Promise<{ closed: true } | { closed: false; working: WorkingBot[] }> {
    const busy = this.state === "running" ? this.working(options.exceptBotId) : [];
    if (busy.length > 0 && !options.force) return { closed: false, working: busy };
    await this.rememberClosed(options.cause, busy);
    await this.pause(options.reason);
    return { closed: true };
  }

  /** Who is using the computer besides `botId`, and whether the user holds the mouse. For a bot about to turn it off. */
  async shutdownCheck(botId: string): Promise<{ others: string[]; userInControl: boolean }> {
    if (this.state !== "running") return { others: [], userInControl: false };
    return { others: this.working(botId).map((b) => b.name), userInControl: this.holder()?.kind === "user" };
  }

  private async rememberClosed(cause: Closed["cause"], bots: WorkingBot[]) {
    if (bots.length === 0) return;
    await this.ctx.storage.put("closed", {
      cause,
      at: Date.now(),
      bots: Object.fromEntries(bots.map((b) => [b.botId, { name: b.name, told: false }])),
    } satisfies Closed);
  }

  /** The record of a shutdown that hit this bot, if it is recent. */
  private async closedFor(botId?: string): Promise<Closed | null> {
    if (!botId) return null;
    const closed = await this.ctx.storage.get<Closed>("closed");
    return closed && Date.now() - closed.at < CLOSED_TTL_MS && closed.bots[botId] ? closed : null;
  }

  /** What a bot is told once the computer was shut down while it worked. */
  private closedText(cause: Closed["cause"]): string {
    switch (cause) {
      case "user":
        return (
          "The user shut the computer down while you were working. It is OFF now and you must NOT ask to turn it on. " +
          "Stop working. Reply with a short final message: say the computer was closed by the user, what you had finished, and that you could not complete the rest."
        );
      case "quota":
        return (
          "The computer shut down because today's computer time ran out. It cannot be turned on again by anyone until 00:00 UTC. Do NOT ask to turn it on. " +
          "Stop working. Reply with a short final message: what you finished, and that you could not complete the rest because the daily computer time ended."
        );
      case "session":
        return (
          "The computer went to sleep while you were working (its session or the wrap-up time ended). " +
          "Stop working. Reply with a short final message: what you finished and what is left. The user can wake the computer and ask you to continue."
        );
    }
  }

  /** The user chose "Wrap up": bots finish and summarise, and the computer sleeps as soon as none is working (or after COMPUTER_WRAP_MINUTES). */
  async wrapUp(): Promise<void> {
    if (this.state !== "running" || this.wrapping) return;
    if (this.working().length === 0) {
      await this.pause("Wrapped up. Your work is saved.");
      return;
    }
    this.wrapping = true;
    this.warned = true;
    this.sessionEndsAt = Math.min(this.sessionEndsAt || Number.POSITIVE_INFINITY, Date.now() + this.wrapMs);
    await this.persist();
    await this.publishStatus();
    await this.scheduleAlarm();
  }

  /** While wrapping up, the computer goes to sleep the moment the last bot has finished. */
  private async sleepIfWrapped() {
    if (this.state === "running" && this.wrapping && this.working().length === 0) await this.pause("Wrapped up. Your work is saved.");
  }

  /**
   * What this bot must be told before its next model call, if anything. Read by the agent's middleware, so a
   * bot that is thinking or searching (not touching the computer) still hears it.
   */
  async notice(botId: string): Promise<string | null> {
    const closed = await this.closedFor(botId);
    if (closed) {
      const entry = closed.bots[botId];
      if (entry && !entry.told) {
        entry.told = true;
        await this.ctx.storage.put("closed", closed);
      }
      return this.closedText(closed.cause);
    }
    if (this.state !== "running") return null;
    const end = await this.endsAt();
    const seconds = Math.max(0, Math.round((end.at - Date.now()) / 1000));
    if (this.wrapping) {
      return (
        `The user asked you to wrap up: the computer goes to sleep in at most ${seconds}s (its state is saved), sooner once every bot is done. ` +
        "Start no new computer work. Finish the step you are on, save anything important to files, then reply with a short summary of what you did and what is left."
      );
    }
    if (end.reason === "quota" && end.at - Date.now() <= this.wrapMs) {
      return (
        `Today's computer time ends in about ${seconds}s. Then the computer shuts down and cannot be turned on again until 00:00 UTC. ` +
        "Start no new computer work. Save anything important to files, then reply with a short summary of what you did and what is left."
      );
    }
    return null;
  }

  /** Next alarm: the regular tick (faster while wrapping up), or sooner when the warning or the end is due. */
  private async scheduleAlarm() {
    const now = Date.now();
    const end = (await this.endsAt()).at;
    const warnAt = end - this.wrapMs;
    const due = [now + (this.wrapping ? WRAP_TICK_MS : TICK_MS), end, warnAt > now ? warnAt : Number.POSITIVE_INFINITY];
    await this.ctx.storage.setAlarm(Math.max(now + 1000, Math.min(...due)));
  }

  /** The user's computer if one exists that this object has no id for (newest kept, any other killed). */
  private async findOwnSandbox(apiKey: string | undefined): Promise<Sandbox | undefined> {
    const userId = this.ctx.id.name;
    if (!userId) return undefined;
    const found = await Sandbox.list({ apiKey, query: { metadata: { app: "k4-bot", userId } } })
      .nextItems()
      .catch(() => []);
    const [keep, ...extra] = found.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    for (const s of extra) await Sandbox.kill(s.sandboxId, { apiKey }).catch(() => undefined);
    if (!keep) return undefined;
    console.log(`[computer] adopted ${keep.sandboxId}${extra.length ? `, killed ${extra.length} extra` : ""}`);
    return Sandbox.connect(keep.sandboxId, { apiKey, timeoutMs: SESSION_MS });
  }

  private async harden(sbx: Sandbox) {
    if (this.hardenedFor === sbx.sandboxId) return;
    await sbx.commands.run(HARDEN, { user: "root" }).catch((e) => console.error("[computer] harden", e));
    this.hardenedFor = sbx.sandboxId;
  }

  private async offMessage(botId?: string): Promise<string> {
    if (this.state === "starting") return "The computer is starting. Wait a few seconds, then try again.";
    const closed = await this.closedFor(botId);
    if (closed) return this.closedText(closed.cause);
    if (this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60 - (await this.usedSeconds()) < MIN_WAKE_SECONDS) {
      return "Today's computer time is used up. Nobody can turn the computer on until 00:00 UTC, so do NOT call turn_on_computer. Tell the user what you could not do.";
    }
    return (
      `The computer is off${this.message ? ` (${this.message.replace(/\.$/, "")})` : ""}. ` +
      "To use it, call turn_on_computer now: that asks the user with an Approve / Reject button, so do not ask them in text."
    );
  }

  /**
   * Runs an agent's work against the running computer. Agents never wake it: when it is off they are told
   * to ask (turn_on_computer, which needs the user's approval). If E2B says it went to sleep on its own,
   * it is marked asleep instead of being woken behind the user's back.
   */
  private async withSandbox<T>(botId: string, fn: (sbx: Sandbox) => Promise<T>): Promise<T> {
    if (this.state !== "running") throw new ComputerOffError(await this.offMessage(botId));
    try {
      return await fn(await this.live());
    } catch (error) {
      // The computer went to sleep (or was shut down) while this call was in flight: say so, not E2B's raw error.
      if (this.state !== "running" || this.pausing) throw new ComputerOffError(await this.offMessage(botId));
      if (!(error instanceof NotFoundError) && !/not running|paused|not found|expired/i.test(String(error))) throw error;
      this.sbx = undefined;
      await this.setState("paused", "Went to sleep.");
      throw new ComputerOffError(await this.offMessage(botId));
    }
  }

  private async touch() {
    this.lastActivity = Date.now();
  }

  // ---------------------------------------------------------------- the lease

  private holder(): Owner | null {
    return this.lease && this.lease.until > Date.now() ? this.lease.owner : null;
  }

  private sameOwner(a: Owner | null, b: Owner) {
    return a !== null && a.kind === b.kind && (a.kind === "user" || (b.kind === "bot" && a.id === b.id));
  }

  /** Waits (up to `waitMs`) until `owner` may drive. Returns a reason string when it may not. */
  private async acquire(owner: Owner, waitMs = 20_000): Promise<string | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      const held = this.holder();
      if (!held || this.sameOwner(held, owner)) {
        this.lease = { owner, until: Date.now() + (owner.kind === "user" ? USER_LEASE_MS : BOT_LEASE_MS) };
        await this.publishStatus();
        return null;
      }
      if (held.kind === "user") return "The user is controlling the computer right now. Wait with the wait action, then try again.";
      if (Date.now() >= deadline) return "Another bot is using the computer right now. Do other work or wait, then try again.";
      await sleep(500);
    }
  }

  /** The bot's run (slice) ended: it lets go of the mouse and is no longer "using" the computer. */
  async releaseBot(botId: string): Promise<void> {
    this.marked.delete(botId);
    this.ctx.storage.sql.exec("DELETE FROM workers WHERE bot_id = ?", botId);
    const closed = await this.ctx.storage.get<Closed>("closed");
    if (closed?.bots[botId]?.told) {
      delete closed.bots[botId];
      await this.ctx.storage.put("closed", closed);
    }
    if (this.lease?.owner.kind === "bot" && this.lease.owner.id === botId) {
      this.lease = null;
    }
    await this.publishStatus();
    await this.sleepIfWrapped();
  }

  /** The user takes the mouse and keyboard. The agent's GUI actions are refused until it is released. */
  async takeControl(): Promise<{ ok: boolean; message?: string }> {
    this.assertEnabled();
    if (this.state !== "running") return { ok: false, message: "The computer is asleep. Wake it first." };
    const held = this.holder();
    if (held?.kind === "bot") {
      // Let the bot finish the action in flight, then it is told the user is in control.
      this.lease = null;
    }
    this.lease = { owner: { kind: "user" }, until: Date.now() + USER_LEASE_MS };
    this.touch();
    // Start the interactive VNC server now, so the first connect after "Take control" is quick.
    if (this.sbx) await this.ensureVnc(this.sbx).catch(() => undefined);
    await this.publishStatus();
    return { ok: true };
  }

  /** The panel pings this while the user is in control, so a closed tab hands control back by itself. */
  async keepControl(): Promise<boolean> {
    if (this.lease?.owner.kind !== "user") return false;
    this.lease.until = Date.now() + USER_LEASE_MS;
    this.touch();
    return true;
  }

  async releaseControl(): Promise<void> {
    if (this.lease?.owner.kind === "user") {
      this.lease = null;
      this.touch();
      await this.publishStatus();
    }
  }

  // ---------------------------------------------------------------- bots

  private isRemoved(botId: string) {
    return this.ctx.storage.sql.exec("SELECT 1 FROM removed_bots WHERE bot_id = ?", botId).toArray().length > 0;
  }

  /**
   * The bot's own Linux account. Its home is 755: every bot may READ every other bot's files, but only
   * the owner can write, rename or delete them (the kernel enforces that, not the prompt). The browser
   * profile (cookies, logins) stays 700, private to the bot. Re-applied once per Durable Object lifetime,
   * which also upgrades homes created before this rule.
   */
  private async botUser(sbx: Sandbox, botId: string): Promise<string> {
    if (this.isRemoved(botId)) throw new ComputerOffError("This bot was deleted.");
    // Every shell, file and screen action of a bot passes here: this is what makes it "using the computer".
    this.markWorking(botId);
    const checked = botUnixUser(botId);
    if (!checked.ok) throw new Error(checked.reason);
    const user = checked.value;
    if (!this.botUsers.has(user)) {
      const home = botHome(user);
      await sbx.commands.run(
        `id -u ${user} >/dev/null 2>&1 || useradd -m -s /bin/bash -K UMASK=022 ${user}; chmod 755 ${home}; install -d -m 700 -o ${user} -g ${user} ${home}/.chrome; ` +
          // Staging for file uploads: bots may pass through (to their own staged file), never list it.
          `install -d -m 711 -o root -g root ${STAGE_DIR}`,
        { user: "root" },
      );
      this.botUsers.add(user);
      this.directoryDirty = true;
    }
    if (this.directoryDirty) await this.writeDirectory(sbx).catch((e) => console.error("[computer] directory", e));
    return user;
  }

  /** Records the bot's display name for /home/BOTS.md. Storage only: never touches E2B. */
  async registerBot(botId: string, name: string): Promise<void> {
    if (this.isRemoved(botId)) return;
    const [row] = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM bots WHERE bot_id = ?", botId).toArray();
    if (row?.name === name) return;
    this.ctx.storage.sql.exec("INSERT INTO bots (bot_id, name) VALUES (?, ?) ON CONFLICT (bot_id) DO UPDATE SET name = excluded.name", botId, name);
    this.directoryDirty = true;
  }

  /** /home/BOTS.md (root-owned, read-only): which folder is which bot, so bots can find each other's files. */
  private async writeDirectory(sbx: Sandbox) {
    const rows = this.ctx.storage.sql.exec<{ bot_id: string; name: string }>("SELECT bot_id, name FROM bots ORDER BY name").toArray();
    const lines = rows.flatMap((r) => {
      const user = botUnixUser(r.bot_id);
      return user.ok ? [`- ${r.name.replace(/[\r\n]+/g, " ")}: ${botHome(user.value)}`] : [];
    });
    const text = `# Bots on this computer\nEvery bot can read these folders. Only a folder's own bot can change or delete its files.\n\n${lines.join("\n")}\n`;
    await sbx.files.write("/home/BOTS.md", text, { user: "root" });
    this.directoryDirty = false;
  }

  /**
   * A bot was deleted: it can never use the computer again (a run still in flight is refused at once),
   * and its account and files are removed now if the computer is awake, or on its next wake otherwise.
   * The computer is never woken just to delete.
   */
  async removeBot(botId: string): Promise<void> {
    const sql = this.ctx.storage.sql;
    sql.exec("INSERT INTO removed_bots (bot_id) VALUES (?) ON CONFLICT (bot_id) DO NOTHING", botId);
    sql.exec("DELETE FROM bots WHERE bot_id = ?", botId);
    sql.exec("DELETE FROM activity WHERE bot_id = ?", botId);
    this.directoryDirty = true;
    await this.releaseBot(botId);
    if (this.state === "running" && this.sbx) await this.purgeRemovedBots(this.sbx);
  }

  private async purgeRemovedBots(sbx: Sandbox) {
    const pending = this.ctx.storage.sql.exec<{ bot_id: string }>("SELECT bot_id FROM removed_bots WHERE purged = 0").toArray();
    for (const { bot_id } of pending) {
      const user = botUnixUser(bot_id);
      if (user.ok) {
        // Stop everything it runs (its browser too), delete what it left in the shared temp folders (by owner,
        // so nobody else's files), then the account with its home (files, browser profile and all).
        await sbx.commands.run(
          `pkill -KILL -u ${user.value}; find /tmp /var/tmp /dev/shm -xdev -user ${user.value} -delete 2>/dev/null; userdel -r -f ${user.value} 2>/dev/null; true`,
          { user: "root", timeoutMs: 120_000 },
        );
        this.botUsers.delete(user.value);
      }
      this.ctx.storage.sql.exec("UPDATE removed_bots SET purged = 1 WHERE bot_id = ?", bot_id);
    }
    if (pending.length > 0 || this.directoryDirty) await this.writeDirectory(sbx);
  }

  private async runAs(sbx: Sandbox, user: string, command: string, timeoutMs = 120_000, background = false) {
    const home = botHome(user);
    // umask 022: what a bot creates is readable (never writable) by the other bots.
    // ulimit -u: a hard cap on the bot's processes and threads (a fork bomb cannot take the computer down;
    // a non-root process can lower it but never raise it again). Chrome alone uses a few hundred threads.
    return sbx.commands.run(`ulimit -u ${BOT_MAX_PROCESSES} 2>/dev/null; umask 022; ${command}`, {
      user,
      cwd: home,
      envs: { HOME: home, DISPLAY: sbx.display, LANG: "C.UTF-8" },
      timeoutMs,
      ...(background ? { background: true as const } : {}),
    });
  }

  /** Shell for the file tools and the `execute` tool. Runs as the bot's own Linux user. */
  async exec(botId: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    if (command.length > 20_000) return { output: "Command too long.", exitCode: 2, truncated: false };
    if (this.execInFlight >= MAX_PARALLEL_EXEC) {
      return { output: "Too many commands are running at once. Wait for one to finish and retry.", exitCode: 75, truncated: false };
    }
    this.execInFlight++;
    try {
      return await this.withSandbox(botId, async (sbx) => {
        const user = await this.botUser(sbx, botId);
        await this.touch();
        try {
          const r = await this.runAs(sbx, user, command, Math.min(timeoutMs ?? 120_000, 600_000));
          const output = r.stdout + r.stderr;
          return { output: cap(output), exitCode: r.exitCode ?? 0, truncated: output.length > MAX_OUTPUT_CHARS };
        } catch (error) {
          // Cut off because the computer is going to sleep: let withSandbox say why (not "timed out").
          if (this.state !== "running" || this.pausing) throw error;
          if (error instanceof CommandExitError) {
            const output = error.stdout + error.stderr;
            return { output: cap(output), exitCode: error.exitCode, truncated: output.length > MAX_OUTPUT_CHARS };
          }
          if (/timeout|timed out/i.test(String(error))) return { output: "Command timed out.", exitCode: 124, truncated: false };
          throw error;
        }
      });
    } finally {
      this.execInFlight--;
    }
  }

  /*
   * Bot file I/O never uses E2B's files API: it acts with root's rights (verified: as one bot it reads
   * another bot's 700 browser profile and writes into its home, also through a symlink planted in the
   * bot's own folder), so path checks in this code could be bypassed. Reads and writes instead run as
   * the bot's own Linux user, and the kernel decides, symlinks included.
   */

  private fileError(error: unknown): "file_not_found" | "is_directory" | "permission_denied" {
    const text = error instanceof CommandExitError ? error.stderr : String(error);
    if (/No such file/i.test(text)) return "file_not_found";
    if (/Is a directory/i.test(text)) return "is_directory";
    return "permission_denied";
  }

  async upload(botId: string, files: Array<[string, Uint8Array]>): Promise<Array<{ path: string; error: string | null }>> {
    return this.withSandbox(botId, async (sbx) => {
      const user = await this.botUser(sbx, botId);
      const out: Array<{ path: string; error: string | null }> = [];
      for (const [path, data] of files) {
        // The bytes go to a root-only staging file readable by this bot's group alone, then the bot itself
        // copies them into place (creating parent folders), so it can only write where Linux lets it.
        const stage = `${STAGE_DIR}/${crypto.randomUUID()}`;
        try {
          await sbx.files.write(stage, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, { user: "root" });
          await sbx.commands.run(
            `chown root:${user} ${stage} && chmod 640 ${stage} && ` +
              `runuser -u ${user} -- sh -c 'umask 022; mkdir -p -- "$(dirname -- "$1")" && cat -- "$2" > "$1"' _ ${shellQuote(path)} ${stage}; ` +
              `rc=$?; rm -f ${stage}; exit $rc`,
            { user: "root", timeoutMs: 60_000 },
          );
          out.push({ path, error: null });
        } catch (error) {
          await sbx.commands.run(`rm -f ${stage}`, { user: "root" }).catch(() => undefined);
          out.push({ path, error: this.fileError(error) });
        }
      }
      return out;
    });
  }

  /** Reads as the bot's own user: other bots' shared files yes, their private browser profile no. */
  async download(botId: string, paths: string[]): Promise<Array<{ path: string; content: Uint8Array | null; error: string | null }>> {
    return this.withSandbox(botId, async (sbx) => {
      const user = await this.botUser(sbx, botId);
      const out: Array<{ path: string; content: Uint8Array | null; error: string | null }> = [];
      for (const path of paths) {
        try {
          // runAs: a bot's command must start in its own home (the default directory is not its to enter).
          const r = await this.runAs(sbx, user, `base64 -w0 -- ${shellQuote(path)}`, 60_000);
          out.push({ path, content: new Uint8Array(Buffer.from(r.stdout, "base64")), error: null });
        } catch (error) {
          out.push({ path, content: null, error: this.fileError(error) });
        }
      }
      return out;
    });
  }

  // ---------------------------------------------------------------- the mouse and keyboard

  private note(botId: string, text: string) {
    const event: ActivityEvent = { botId, text, at: Date.now() };
    const sql = this.ctx.storage.sql;
    sql.exec("INSERT INTO activity (at, bot_id, text) VALUES (?, ?, ?)", event.at, botId, text);
    sql.exec("DELETE FROM activity WHERE rowid <= (SELECT MAX(rowid) FROM activity) - ?", ACTIVITY_KEEP);
    this.broadcast({ type: "activity", event });
  }

  /**
   * Records what a bot did with the shell or files for the Activity feed (the screen actions are noted
   * in `act`). Storage and a socket broadcast only: it never touches E2B. Called by the run workflow.
   */
  async logActivity(botId: string, text: string): Promise<void> {
    if (this.isRemoved(botId)) return;
    this.note(botId, text.replace(/\s+/g, " ").slice(0, 160));
  }

  private recentActivity(limit = 30): ActivityEvent[] {
    return this.ctx.storage.sql
      .exec<{ at: number; botId: string; text: string }>(
        "SELECT at, bot_id AS botId, text FROM activity ORDER BY rowid DESC LIMIT ?",
        limit,
      )
      .toArray()
      .reverse();
  }

  private rateLimited(): boolean {
    const now = Date.now();
    this.recentActions = this.recentActions.filter((t) => now - t < 60_000);
    if (this.recentActions.length >= ACTIONS_PER_MINUTE) return true;
    this.recentActions.push(now);
    return false;
  }

  /**
   * One GUI action, followed by a screenshot. Everything is validated again here:
   * the tool already validated it, but this is the trust boundary, so it does not rely on the caller.
   */
  async act(botId: string, runId: string, input: unknown): Promise<ActionResult> {
    if (this.state !== "running") return { ok: false, text: await this.offMessage(botId) };
    const parsed = computerActionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, text: `Invalid action: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Coordinates are whole PIXELS on the ${SCREEN.width}x${SCREEN.height} screenshot, not fractions.` };
    const action = parsed.data;

    const used = (this.runActions.get(runId) ?? 0) + 1;
    if (used > this.cfg.COMPUTER_MAX_ACTIONS_PER_RUN) {
      return { ok: false, text: "This task has used its computer action budget. Summarise what you did and stop, or ask the user to continue." };
    }
    if (this.rateLimited()) return { ok: false, text: "Too many actions this minute. Use the wait action, then continue." };
    this.runActions.set(runId, used);
    if (this.runActions.size > 200) this.runActions.delete(this.runActions.keys().next().value!);

    const owner: Owner = { kind: "bot", id: botId };
    const refused = await this.acquire(owner);
    if (refused) return { ok: false, text: refused };

    // Serialised: two bots' clicks and keystrokes must never interleave.
    const run = this.gui.then(() => this.perform(botId, action));
    this.gui = run.catch(() => undefined);
    return run;
  }

  private async perform(botId: string, action: ComputerAction): Promise<ActionResult> {
    try {
      return await this.withSandbox(botId, async (sbx) => {
        await this.touch();
        const user = await this.botUser(sbx, botId);
        const q = (n: number) => String(Math.round(n));

        // Switching bots: bring that bot's windows to the front before it acts.
        if (this.lastDriver !== botId) {
          await sbx.commands
            .run(`xdotool search --onlyvisible --class ${shellQuote(`k4_${user}`)} | head -1 | xargs -r xdotool windowactivate`)
            .catch(() => undefined);
          this.lastDriver = botId;
        }
        if (this.lease?.owner.kind === "bot") this.lease.until = Date.now() + BOT_LEASE_MS;

        let text: string;
        switch (action.action) {
          case "screenshot":
            text = "Screenshot taken.";
            break;
          case "mouse_move":
            await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)}`);
            text = `Moved the mouse to (${action.x}, ${action.y}).`;
            break;
          case "left_click":
          case "right_click":
          case "middle_click": {
            const button = { left_click: 1, right_click: 3, middle_click: 2 }[action.action];
            // No `--sync`: it waits ~15s when the pointer is already at the target.
            await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)} click ${button}`);
            text = `${action.action.replace("_", " ")} at (${action.x}, ${action.y}).`;
            break;
          }
          case "double_click":
            await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)} click --repeat 2 --delay 80 1`);
            text = `Double-clicked at (${action.x}, ${action.y}).`;
            break;
          case "left_click_drag":
            await sbx.commands.run(
              `xdotool mousemove ${q(action.x)} ${q(action.y)} mousedown 1 sleep 0.15 mousemove ${q(action.toX)} ${q(action.toY)} sleep 0.15 mouseup 1`,
            );
            text = `Dragged from (${action.x}, ${action.y}) to (${action.toX}, ${action.toY}).`;
            break;
          case "type": {
            const checked = checkTypedText(action.text);
            if (!checked.ok) return { ok: false, text: checked.reason };
            for (let i = 0; i < action.text.length; i += 500) {
              await sbx.commands.run(`xdotool type --delay 12 --clearmodifiers -- ${shellQuote(action.text.slice(i, i + 500))}`);
            }
            text = `Typed ${action.text.length} characters.`;
            break;
          }
          case "key": {
            const keys = checkKeys(action.keys);
            if (!keys.ok) return { ok: false, text: keys.reason };
            await sbx.commands.run(`xdotool key --clearmodifiers ${keys.value.map(shellQuote).join(" ")}`);
            text = `Pressed ${keys.value.join(" ")}.`;
            break;
          }
          case "scroll": {
            if (action.x !== undefined && action.y !== undefined) {
              await sbx.commands.run(`xdotool mousemove ${q(action.x)} ${q(action.y)}`);
            }
            const button = { up: 4, down: 5, left: 6, right: 7 }[action.direction];
            await sbx.commands.run(`xdotool click --repeat ${action.amount} --delay 40 ${button}`);
            text = `Scrolled ${action.direction} by ${action.amount}.`;
            break;
          }
          case "wait":
            await sleep(action.seconds * 1000);
            text = `Waited ${action.seconds}s.`;
            break;
          case "open_url": {
            const checked = checkUrl(action.url, parseAllowedHosts(this.cfg.COMPUTER_ALLOWED_HOSTS));
            if (!checked.ok) return { ok: false, text: checked.reason };
            // Own profile + own window class per bot: cookies and windows are never shared between bots.
            await this.runAs(
              sbx,
              user,
              `nohup google-chrome --class=${shellQuote(`k4_${user}`)} --user-data-dir=${shellQuote(`${botHome(user)}/.chrome`)} ` +
                `--no-first-run --no-default-browser-check --start-maximized --new-window ${shellQuote(checked.value)} >/dev/null 2>&1 &`,
              15_000,
              true,
            );
            // A cold Chrome start takes several seconds: wait for its window instead of returning a desktop screenshot.
            await this.runAs(
              sbx,
              user,
              `for i in $(seq 1 30); do xdotool search --onlyvisible --class ${shellQuote(`k4_${user}`)} >/dev/null 2>&1 && break; sleep 0.5; done`,
              20_000,
            );
            text = `Opened ${checked.value} in your browser window.`;
            break;
          }
        }

        await sleep(SETTLE_MS[action.action]);
        const screenshot = await sbx.screenshot();
        this.note(botId, text);
        return { ok: true, text, screenshot };
      });
    } catch (error) {
      return { ok: false, text: `Computer error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // ---------------------------------------------------------------- live view

  /**
   * Which of our VNC servers are up with the current flags. A server started by an older version
   * (without `-noxdamage`) counts as down, so it is replaced and the preview gets the fix too.
   */
  private async vncUp(sbx: Sandbox) {
    const r = await sbx.commands.run(`ss -ltn | awk '{print $4}'; echo ===; pgrep -af x11vnc || true`);
    const [ports = "", procs = ""] = r.stdout.split("===");
    const ok = (p: Ports) =>
      ports.includes(`:${p.web}`) && procs.split("\n").some((l) => l.includes(`-rfbport ${p.vnc}`) && l.includes("-noxdamage"));
    return { view: ok(VIEW), control: ok(CONTROL) };
  }

  /**
   * Starts the two VNC servers (read-only and interactive) on first use. Idempotent.
   * `-noxdamage`: x11vnc otherwise waits for X "damage" events, and Chrome's compositor does not send them
   * for most of what it draws, so the preview froze while a bot scrolled or typed in the browser (verified).
   * Without them x11vnc compares the screen itself every `-wait` ms (50, as E2B's own stream does).
   */
  private async ensureVnc(sbx: Sandbox) {
    if (this.vncFor === sbx.sandboxId) return;
    const up = await this.vncUp(sbx);
    const start = async (ports: Ports, viewOnly: boolean) => {
      // "[-]": the pattern must not match this very shell's own command line, or pkill kills it too.
      await sbx.commands.run(`pkill -f "[-]rfbport ${ports.vnc}"; pkill -f "[-]-listen ${ports.web}"; true`);
      await sbx.commands.run(
        `x11vnc -bg -display ${sbx.display} -forever -shared -nopw -noxdamage -wait 50 ${viewOnly ? "-viewonly " : ""}-rfbport ${ports.vnc} 2>/tmp/x11vnc-${ports.vnc}.log`,
      );
      await sbx.commands.run(
        `cd /opt/noVNC/utils && nohup ./novnc_proxy --vnc localhost:${ports.vnc} --listen ${ports.web} --web /opt/noVNC >/tmp/novnc-${ports.web}.log 2>&1 &`,
        { background: true, timeoutMs: 0 },
      );
    };
    if (!up.view) await start(VIEW, true);
    if (!up.control) await start(CONTROL, false);
    for (let i = 0; i < 20; i++) {
      const now = await this.vncUp(sbx);
      if (now.view && now.control) break;
      await sleep(300);
    }
    this.vncFor = sbx.sandboxId;
  }

  /** Where the Worker proxy should connect. Never wakes a sleeping computer (that costs money). */
  async viewerTarget(mode: "watch" | "control"): Promise<{ host: string; token: string } | { error: string }> {
    if (this.state !== "running") return { error: "asleep" };
    if (mode === "control" && this.holder()?.kind !== "user") return { error: "not_in_control" };
    try {
      // After a Durable Object eviction the VM is still running: reconnecting to it costs nothing.
      const sbx = this.sbx ?? (await this.live());
      await this.ensureVnc(sbx);
      return { host: sbx.getHost((mode === "watch" ? VIEW : CONTROL).web), token: sbx.trafficAccessToken ?? "" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "unavailable" };
    }
  }

  // ---------------------------------------------------------------- panel websocket + meter

  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not found", { status: 404 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify({ type: "status", status: await this.status() }));
    pair[1].send(JSON.stringify({ type: "activity-batch", events: this.recentActivity() }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    // 1005/1006 only describe how the peer went away; they may not be sent back (the runtime throws).
    ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
  }

  private broadcast(message: unknown) {
    const frame = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch {
        // a closed socket is cleaned up by webSocketClose
      }
    }
  }

  /**
   * Runs every 30s while the computer is awake: counts the minutes used (the
   * budget guard), pauses it when idle, and keeps E2B's own timeout ahead of
   * real activity without calling E2B on every action.
   */
  override async alarm() {
    if (await this.ctx.storage.get<boolean>("provision")) await this.runProvisioning();
    if (this.state !== "running") return;
    const now = Date.now();
    const usage = await this.ctx.storage.get<{ day: string; seconds: number }>("usage");
    const base = usage?.day === today() ? usage.seconds : 0;
    const seconds = base + Math.min(now - this.lastTick, 2 * TICK_MS) / 1000;
    this.lastTick = now;
    await this.ctx.storage.put("usage", { day: today(), seconds });

    const userInControl = this.holder()?.kind === "user";
    const idleMs = this.cfg.COMPUTER_IDLE_MINUTES * 60_000;

    if (seconds >= this.cfg.COMPUTER_MAX_MINUTES_PER_DAY * 60) {
      await this.rememberClosed("quota", this.working());
      await this.pause("Daily computer time limit reached.");
    } else if (this.sessionEndsAt && now >= this.sessionEndsAt) {
      const wrapped = this.wrapping;
      await this.rememberClosed("session", this.working());
      await this.pause(wrapped ? "Wrapped up. Your work is saved." : `The ${this.cfg.COMPUTER_SESSION_MINUTES}-minute session ended. Your work is saved.`);
    } else if (this.wrapping && this.working().length === 0) {
      await this.pause("Wrapped up. Your work is saved.");
    } else if (!userInControl && now - this.lastActivity > idleMs) {
      await this.pause("Paused after being idle. Your work is saved.");
    } else {
      // The end is near (the session's or today's computer time): the user is asked, in the chat, to wrap up or stop now.
      if (!this.warned && (await this.endsAt()).at - now <= this.wrapMs) {
        this.warned = true;
      }
      if (this.sbx && this.expiresAt - now < EXTEND_WHEN_BELOW_MS) {
        await this.sbx.setTimeout(SESSION_MS).catch(() => undefined);
        this.expiresAt = now + SESSION_MS;
      }
      await this.persist();
      await this.publishStatus();
      await this.scheduleAlarm();
    }
  }
}
