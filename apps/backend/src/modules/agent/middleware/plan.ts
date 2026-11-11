import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { tool } from "langchain";
import { createMiddleware } from "langchain";
import { z } from "zod";

/** Steps the model may check off with evidence; the UI renders them in array order. */
const stepInput = z.object({
  id: z.string().min(1).max(16),
  title: z.string().min(3).max(120),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  evidence: z.string().max(300).optional(),
});

type Step = z.infer<typeof stepInput>;
export const PLAN_TOOLS = ["create_plan", "update_plan", "finish_plan"] as const;
export const REMINDER = "[Automatic plan check]";
const MAX_REMINDERS = 2;

/** A plan as it can be read back from the conversation: the last plan tool call of this turn. */
export function planOf(messages: BaseMessage[]): Step[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!AIMessage.isInstance(m)) continue;
    const call = [...(m.tool_calls ?? [])].reverse().find((c) => c.name === "create_plan" || c.name === "update_plan");
    if (!call) continue;
    const args = call.args as { steps?: Array<Partial<Step>> };
    if (!Array.isArray(args.steps)) return null;
    return args.steps.map((s, index) => ({
      id: String(s.id ?? `s${index + 1}`),
      title: String(s.title ?? ""),
      status: (s.status ?? "pending") as Step["status"],
      ...(s.evidence ? { evidence: String(s.evidence) } : {}),
    }));
  }
  return null;
}

/** Why this plan edit is not allowed, or null when it is. Exported for the check script. */
export function planProblem(steps: Step[]): string | null {
  if (steps.length < 2 || steps.length > 10) return "Send the whole plan (2 to 10 steps).";
  if (steps.filter((s) => s.status === "in_progress").length > 1) return "Only one step may be in_progress at a time.";
  for (const s of steps) {
    if (s.status === "completed" && !s.evidence?.trim()) {
      return `Step "${s.title}" is completed: add the evidence that proves it (a tool result, a test, the workflow state).`;
    }
  }
  const doing = steps.findIndex((s) => s.status === "in_progress");
  if (doing > -1 && steps.findIndex((s, i) => i < doing && (s.status === "pending" || s.status === "in_progress")) > -1) {
    return "Finish or cancel the earlier steps before starting this one; plans run in order.";
  }
  return null;
}

/** Tools whose result counts as having researched the task before planning. */
export type PlanMiddlewareOptions = { researchTools: string[] };

/**
 * A plan the model must create before multi-step work and close before answering.
 * The built-in todoListMiddleware neither orders steps nor blocks a final answer with open ones;
 * both are enforced here in code, and the UI reads the plan from the tool calls themselves.
 */
export function createPlanMiddleware(options: PlanMiddlewareOptions) {
  const research = new Set(options.researchTools);

  const researched = (messages: BaseMessage[]) =>
    messages.some((m) => AIMessage.isInstance(m) && (m.tool_calls ?? []).some((c) => research.has(c.name)));

  const createPlan = tool(
    async ({ goal, steps }) => {
      if (steps.length < 2 || steps.length > 10) return "A plan has 2 to 10 steps.";
      const titles = steps.map((s) => s.title.trim().toLowerCase());
      if (new Set(titles).size !== titles.length) return "Every step needs a different title.";
      return JSON.stringify({
        ok: true,
        plan: steps.map((s, i) => ({ id: `s${i + 1}`, order: i, title: s.title, status: "pending", ...(s.acceptance ? { acceptance: s.acceptance } : {}) })),
        next: "Work one step at a time: update_plan with the full list, marking the current step in_progress.",
      });
    },
    {
      name: "create_plan",
      description:
        "Create the ordered plan for this turn (2-10 steps). Call it only after you have researched the task (read the workflow, searched tools, read the relevant block/app details). Each step is a short action; add an acceptance criterion when success is checkable.",
      schema: z.object({
        goal: z.string().min(3).max(300),
        steps: z.array(z.object({ title: z.string().min(3).max(120), acceptance: z.string().max(240).optional() })).min(2).max(10),
      }),
    },
  );

  const updatePlan = tool(
    async ({ steps }) => {
      const problem = planProblem(steps);
      if (problem) return problem;
      return JSON.stringify({ ok: true, steps, open: steps.some((s) => s.status === "pending" || s.status === "in_progress") });
    },
    {
      name: "update_plan",
      description:
        "Rewrite the whole plan with the current state of every step. Mark the step you are working on in_progress before doing it, and completed only with evidence. Steps run in order: do not start a later step while an earlier one is open.",
      schema: z.object({ steps: z.array(stepInput).min(2).max(10) }),
    },
  );

  const finishPlan = tool(
    async ({ steps }) => {
      const open = steps.filter((s) => s.status === "pending" || s.status === "in_progress");
      return open.length === 0
        ? "All steps are closed."
        : "Still open: " + open.map((s) => s.title).join("; ") + ". Finish them or cancel them with a reason in the evidence.";
    },
    {
      name: "finish_plan",
      description: "Call before your final answer. Refuses while any step is pending or in progress: close every step first.",
      schema: z.object({ steps: z.array(stepInput).min(2).max(10) }),
    },
  );

  return createMiddleware({
    name: "PlanMiddleware",
    tools: [createPlan, updatePlan, finishPlan],
    afterModel: {
      canJumpTo: ["model"],
      hook: (state) => {
        const messages = state.messages as BaseMessage[];
        const last = messages.at(-1);
        if (!last || !AIMessage.isInstance(last) || (last.tool_calls?.length ?? 0) > 0) return undefined;
        const plan = planOf(messages);
        if (!plan) return undefined;
        const open = plan.filter((s) => s.status === "pending" || s.status === "in_progress");
        if (open.length === 0) return undefined;
        let start = 0;
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i]!;
          if (HumanMessage.isInstance(m) && typeof m.content === "string" && !m.content.startsWith(REMINDER)) {
            start = i;
            break;
          }
        }
        const sent = messages.slice(start).filter((m) => HumanMessage.isInstance(m) && typeof m.content === "string" && m.content.startsWith(REMINDER)).length;
        if (sent >= MAX_REMINDERS) return undefined;
        return {
          messages: [new HumanMessage(`${REMINDER} The plan still has open steps: ${open.map((s) => s.title).join("; ")}. Finish or cancel them with update_plan (completed needs evidence), then answer.`)],
          jumpTo: "model" as const,
        };
      },
    },
  });
}
