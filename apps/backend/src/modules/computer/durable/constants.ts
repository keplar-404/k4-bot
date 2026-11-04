import type { ComputerAction, ComputerState } from "../types";

/** E2B sandbox timeout. Extended while there is activity; on expiry E2B pauses (never kills) the computer. */
export const SESSION_MS = 10 * 60_000;
export const EXTEND_WHEN_BELOW_MS = 3 * 60_000;
/** A bot keeps the mouse and keyboard this long after its last action, so a crashed run cannot block others. */
export const BOT_LEASE_MS = 45_000;
export const USER_LEASE_MS = 5 * 60_000;
export const TICK_MS = 30_000;
export const ACTIONS_PER_MINUTE = 90;
export const MAX_PARALLEL_EXEC = 4;
export const MAX_OUTPUT_CHARS = 30_000;
/** A bot counts as "using the computer" this long after its last shell, file or screen action (and until its run ends). */
export const BUSY_MS = 3 * 60_000;
/** How long a bot is still told that the computer was shut down under it (a later, unrelated run is not). */
export const CLOSED_TTL_MS = 30 * 60_000;
/** The tick while bots are wrapping up: the computer sleeps as soon as the last one is done. */
export const WRAP_TICK_MS = 10_000;
/** Waking needs at least this much of today's computer time left: booting for a few seconds of use is waste. */
export const MIN_WAKE_SECONDS = 60;
/** The saved screen must fit one Durable Object storage value (2 MiB). */
export const MAX_SNAPSHOT_BYTES = 1_900_000;
export const ACTIVITY_KEEP = 200;
export const STAGE_DIR = "/var/lib/k4-stage";
/** Per bot account, across all of its commands and its browser. */
export const BOT_MAX_PROCESSES = 2048;

/** Our own VNC servers. 5911/6091 is read-only (enforced by x11vnc itself), 5912/6092 is interactive. */
export type Ports = { vnc: number; web: number };
export const VIEW: Ports = { vnc: 5911, web: 6091 };
export const CONTROL: Ports = { vnc: 5912, web: 6092 };

export const SETTLE_MS: Record<ComputerAction["action"], number> = {
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

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const today = () => new Date().toISOString().slice(0, 10);
export const cap = (s: string) => (s.length > MAX_OUTPUT_CHARS ? `${s.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]` : s);

/** What is persisted across evictions. */
export type Core = {
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
export type Closed = {
  cause: "user" | "quota" | "session" | "reset";
  at: number;
  bots: Record<string, { name: string; told: boolean }>;
};

/** Thrown to the agent's tools when the computer is not on. Agents never wake it by themselves. */
export class ComputerOffError extends Error {}
