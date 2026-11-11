import { readForm } from "../graph/manual-form";
import type { WorkflowNode } from "../graph/schema";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What the trigger block hands the first step, so a test run looks like the real thing. */
export function triggerInput(trigger: WorkflowNode | undefined, input: unknown) {
  const kind = trigger?.kind;
  const now = new Date().toISOString();
  if (kind === "trigger.webhook") return { body: input ?? {}, headers: {}, receivedAt: now };
  if (kind === "trigger.schedule") return { scheduledAt: now };
  // A test of an app-event workflow: the sample event the user typed stands in for the real one.
  if (kind === "trigger.app") return { event: "test", data: isPlainObject(input) ? input : {}, eventId: "test", receivedAt: now };
  const raw = isPlainObject(input) ? input : {};
  // A manual trigger's form: values typed and required fields checked (problems go back to the person).
  return trigger?.kind === "trigger.manual" ? readForm(trigger.config.fields, raw) : { inputs: raw };
}
