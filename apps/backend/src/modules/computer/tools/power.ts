import { tool } from "langchain";
import { interrupt } from "@langchain/langgraph";
import { z } from "zod";
import type { ComputerStub } from "../sandbox-backend";

export function createPowerTools(computer: ComputerStub, botId: string) {
  // Power. Waking is gated by Deep Agents' human-in-the-loop (`interruptOn` in agent.ts): it costs computer time.
  // Turning off asks the user only when it would hurt someone: another bot is working, or the user holds the mouse.
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
      const check = await computer.shutdownCheck(botId);
      const busy = check.others.length > 0 || check.userInControl;
      if (busy) {
        const who = [...check.others.map((n) => `"${n}"`), ...(check.userInControl ? ["you"] : [])];
        // Re-asked if the run resumes: this read is repeated, never a write, so that is safe.
        const reply = interrupt({
          kind: "confirm",
          question: `${who.join(" and ")} ${check.others.length + (check.userInControl ? 1 : 0) > 1 ? "are" : "is"} still using the computer. Turn it off anyway? Their work on it stops.`,
        });
        if (String(reply).trim().toLowerCase() !== "yes") {
          return "The user chose to keep the computer on. Do NOT turn it off. Carry on with your task, or finish and tell the user.";
        }
      }
      const result = await computer.close({ reason: "Turned off by a bot. Your work is saved.", cause: "user", force: busy, exceptBotId: botId });
      return result.closed
        ? "The computer is off. Its open apps and files are saved."
        : `Not turned off: ${result.working.map((b) => b.name).join(", ")} just started working on it. Leave it on and finish your task.`;
    },
    {
      name: "turn_off_computer",
      description:
        "Turn the user's computer off (it sleeps with apps and files saved) when you no longer need it. " +
        "If another bot is working on it, the user is asked first; if they say no, leave it on.",
      schema: z.object({}),
    },
  );

  return [turnOn, turnOff];
}
