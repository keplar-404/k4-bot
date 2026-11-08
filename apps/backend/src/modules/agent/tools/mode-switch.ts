import { interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import type { ChatMode } from "../../chat/modes";

/**
 * Offered only in Plan mode: asks the user to switch modes so the plan can be carried out. The run pauses until the
 * user answers. What the model is told comes from the thread's real mode (read after the answer), never from the
 * answer text, so a forged reply cannot make the model believe it may act.
 */
export const createModeSwitch = (readMode: () => Promise<ChatMode>) =>
  tool(
    async ({ to, reason, plan }) => {
      const reply = interrupt({ kind: "mode_switch", to, reason, plan });
      const now = await readMode();
      if (reply === "stay" || now === "plan") return "The user kept Plan mode. Do not act; refine the plan if asked.";
      return `The user switched to ${now} mode. Carry out the plan now.`;
    },
    {
      name: "request_mode_switch",
      description:
        "In Plan mode only: ask the user to switch to Ask or Allow all so you can carry out the plan. Include the plan and a short reason.",
      schema: z.object({
        to: z.enum(["ask", "allow_all"]).describe("The mode to switch to."),
        reason: z.string().max(300).describe("Why you need to act now."),
        plan: z.string().max(2000).describe("The numbered plan you will carry out."),
      }),
    },
  );
