import { interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

// LangGraph dynamic interrupt: the run pauses (for hours or days, at no cost) until the user answers.
export const askUser = tool(
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
export const waitFor = tool(
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

