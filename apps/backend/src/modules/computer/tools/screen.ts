import { tool } from "langchain";
import { z } from "zod";
import type { ComputerStub } from "../sandbox-backend";
import { SCREEN } from "../types";

/** Holds the most recent screenshot of this run so the middleware can show it to the model. Never persisted. */
export interface ScreenHolder {
  latest?: Uint8Array;
}

const ACTIONS = [
  "screenshot",
  "left_click",
  "right_click",
  "double_click",
  "middle_click",
  "mouse_move",
  "left_click_drag",
  "type",
  "key",
  "scroll",
  "wait",
  "open_url",
] as const;

/**
 * Flat on purpose: OpenAI-compatible providers (OpenRouter) reject a tool whose
 * top-level schema is a union. The strict, per-action validation happens in the
 * Durable Object, which is the trust boundary.
 */
const computerSchema = z.object({
  action: z.enum(ACTIONS).describe("What to do."),
  x: z.number().optional().describe(`Pixels from the left edge, 0-${SCREEN.width - 1}. For clicks, mouse_move, drag start and scroll position.`),
  y: z.number().optional().describe(`Pixels from the top edge, 0-${SCREEN.height - 1}.`),
  toX: z.number().optional().describe("Drag end, x."),
  toY: z.number().optional().describe("Drag end, y."),
  text: z.string().optional().describe("Text to type into the focused field (type action)."),
  keys: z.string().optional().describe('Key or combination for the key action, e.g. "Return", "ctrl+l", "alt+Left". Several keys separated by spaces.'),
  direction: z.enum(["up", "down", "left", "right"]).optional().describe("Scroll direction."),
  amount: z.number().optional().describe("Scroll steps, 1-30. Default 3."),
  seconds: z.number().optional().describe("Seconds to wait, 0.5-30 (wait action)."),
  url: z.string().optional().describe("http(s) address to open in your own browser window (open_url action)."),
});

export function createScreenTool({ computer, botId, runId, screen }: { computer: ComputerStub; botId: string; runId: string; screen: ScreenHolder }) {
  return tool(
    async (args) => {
      const result = await computer.act(botId, runId, args);
      if (result.screenshot) screen.latest = result.screenshot;
      return result.ok
        ? `${result.text} The new screenshot (${SCREEN.width}x${SCREEN.height}) is attached below.`
        : `NOT DONE: ${result.text}`;
    },
    {
      name: "computer",
      description:
        `Use the shared computer's screen (${SCREEN.width}x${SCREEN.height}) with a mouse and keyboard. Every call returns a fresh screenshot. ` +
        "Look at the screenshot before acting and check it after every action. " +
        "open_url opens a page in YOUR OWN browser window; use it instead of typing into the address bar. " +
        "Prefer keyboard shortcuts for menus and scrolling. Never type passwords, payment cards or codes: use ask_user.",
      schema: computerSchema,
    },
  );
}
