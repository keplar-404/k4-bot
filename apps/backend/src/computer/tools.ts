import { interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import type { ComputerStub } from "./sandbox-backend";
import { SCREEN } from "./types";

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

export function createComputerTools(options: {
  computer: ComputerStub;
  botId: string;
  runId: string;
  screen: ScreenHolder;
}) {
  const { computer, botId, runId, screen } = options;

  const computerTool = tool(
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

  // LangGraph dynamic interrupt: the run pauses (for hours or days, at no cost) until the user answers.
  const askUser = tool(
    ({ question, kind }) => {
      const reply = interrupt({ kind, question });
      return typeof reply === "string" ? reply : JSON.stringify(reply);
    },
    {
      name: "ask_user",
      description:
        "Pause and ask the human. REQUIRED for: logins and passwords, 2-step codes, CAPTCHAs, payments, accepting terms, " +
        "sending messages or emails on their behalf, deleting things, and anything you are unsure about. " +
        "The user can take over the computer, finish the step, and reply. Returns their answer.",
      schema: z.object({
        question: z.string().max(500).describe("What you need, in one or two plain sentences."),
        kind: z.enum(["credentials", "captcha", "two_factor", "payment", "consent", "info"]).describe("Why you are asking."),
      }),
    },
  );

  // Another dynamic interrupt, handled by the Workflow with step.sleep: no process or VM time is used while waiting.
  const waitFor = tool(
    ({ minutes, reason }) => {
      interrupt({ kind: "sleep", ms: Math.round(minutes * 60_000), reason });
      return `Resumed after waiting ${minutes} minutes.`;
    },
    {
      name: "wait_for",
      description:
        "Sleep until later without using any resources, then continue this same task. Use for recurring checks and for work that " +
        "must happen at a given time. Up to 7 days.",
      schema: z.object({
        minutes: z.number().min(1).max(7 * 24 * 60).describe("How long to sleep."),
        reason: z.string().max(200).describe("What you are waiting for."),
      }),
    },
  );

  // Power. Both are gated by Deep Agents' human-in-the-loop (`interruptOn` in agent.ts): the run pauses
  // and these only execute after the user approves, because waking costs computer time and sleeping
  // the computer stops the user's other bots too.
  const turnOn = tool(
    async () => {
      await computer.ensure();
      return "The computer is on. Take a screenshot to see it.";
    },
    {
      name: "turn_on_computer",
      description: "Turn on the user's computer when it is off and you need it. The user must approve. It uses their daily computer time.",
      schema: z.object({}),
    },
  );

  const turnOff = tool(
    async () => {
      await computer.pause("Turned off by a bot. Your work is saved.");
      return "The computer is off. Its open apps and files are saved.";
    },
    {
      name: "turn_off_computer",
      description: "Turn the user's computer off (it sleeps with apps and files saved) when the task no longer needs it. The user must approve.",
      schema: z.object({}),
    },
  );

  return [computerTool, askUser, waitFor, turnOn, turnOff];
}
