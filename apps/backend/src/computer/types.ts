import { z } from "zod";

/** Screenshots are 1280x800 (~1.0 MP): within every vision model's image limit, and what Anthropic recommends for web apps. */
export const SCREEN = { width: 1280, height: 800 } as const;

const coord = {
  x: z.number().int().min(0).max(SCREEN.width - 1),
  y: z.number().int().min(0).max(SCREEN.height - 1),
};

/** The one place the shape of a computer action is defined. The tool, the Durable Object and the UI all use it. */
export const computerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("screenshot") }),
  z.object({
    action: z.enum(["left_click", "right_click", "double_click", "middle_click", "mouse_move"]),
    ...coord,
  }),
  z.object({
    action: z.literal("left_click_drag"),
    ...coord,
    toX: coord.x,
    toY: coord.y,
  }),
  z.object({ action: z.literal("type"), text: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("key"), keys: z.string().min(1).max(120) }),
  z.object({
    action: z.literal("scroll"),
    x: coord.x.optional(),
    y: coord.y.optional(),
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number().int().min(1).max(30).default(3),
  }),
  z.object({ action: z.literal("wait"), seconds: z.number().min(0.5).max(30) }),
  z.object({ action: z.literal("open_url"), url: z.string().min(1).max(2048) }),
]);
export type ComputerAction = z.infer<typeof computerActionSchema>;

/** Who is driving the mouse and keyboard. Only one party may at a time. */
export type Owner = { kind: "bot"; id: string } | { kind: "user" };

export type ComputerState = "off" | "starting" | "running" | "paused" | "error";

/** Everything the UI needs, readable without calling E2B. */
export interface ComputerStatus {
  state: ComputerState;
  /** Who holds the mouse and keyboard right now. */
  lease: Owner | null;
  minutesUsedToday: number;
  minutesLimit: number;
  /** Why it is in this state ("Paused after being idle.", "Starting the screen…", an error). */
  message?: string;
  /**
   * While running: time left in this session. `warning` once the user should be asked to wrap up;
   * `wrapping` after they chose to (the bots are told to finish and summarise).
   */
  session?: { endsInMs: number; warning: boolean; wrapping: boolean };
  /** When the last screen was saved (taken when the computer goes to sleep). */
  snapshotAt?: number;
  updatedAt: number;
}

export interface ActivityEvent {
  botId: string;
  /** Short human text, e.g. "Clicked (640, 400)". */
  text: string;
  at: number;
}

/** Result of one computer action. The screenshot is the model's eyes; it is never persisted. */
export interface ActionResult {
  ok: boolean;
  text: string;
  screenshot?: Uint8Array;
}

export interface ExecResult {
  output: string;
  exitCode: number;
  truncated: boolean;
}
