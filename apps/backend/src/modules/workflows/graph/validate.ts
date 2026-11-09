import { isTimeZone } from "../../schedules/zone";
import { NEEDS_FIELD } from "./list-blocks";
import { scheduleIssue } from "../../schedules/issues";
import { isTrigger, LIMITS, type WorkflowGraph, type WorkflowNode } from "./schema";
import { decideIssue } from "./decide-issues";
import { loopIssues, loopOf } from "./loop-rules";
import { type GraphIssue, structureIssues } from "./structure";

// Save-time rules live in structure.ts; most callers import everything from here.
export { type GraphIssue, structureIssues, topoOrder } from "./structure";

const DELAY_SECONDS = { seconds: 1, minutes: 60, hours: 3600, days: 86400 } as const;

/** Everything a workflow needs before it can be turned on (or test-run): one trigger, every block wired and filled in. */
export function publishIssues(g: WorkflowGraph): GraphIssue[] {
  const issues = [...structureIssues(g), ...loopIssues(g)];
  const trigger = g.nodes.find(isTrigger);
  if (!trigger) issues.push({ message: "Add a trigger: what starts this workflow." });
  if (g.nodes.length < 2) issues.push({ message: "Add at least one step after the trigger." });

  const connected = trigger ? reachableFrom(g, trigger.id) : null;
  const loop = loopOf(g);
  let totalDelaySeconds = 0;
  for (const node of g.nodes) {
    if (connected && !connected.has(node.id)) {
      issues.push({ nodeId: node.id, message: "This block is not connected to the trigger." });
    }
    const message = blockIssue(node);
    if (message) issues.push({ nodeId: node.id, message });
    // A delay inside a For each waits once per item.
    const repeats = loop?.body.has(node.id) ? loop.loop.config.max : 1;
    if (node.kind === "logic.delay") totalDelaySeconds += delaySeconds(node) * repeats;
  }

  if (totalDelaySeconds > LIMITS.maxDelaySeconds) {
    issues.push({ message: "All the delays together (each one inside a For each counts per item) can be at most 7 days." });
  }
  return issues;
}

/** What is missing or not allowed in one block's settings, or null. */
function blockIssue(node: WorkflowNode): string | null {
  // A secret copied into a condition or a Set field would end up in step outputs.
  const isAction = node.kind === "action.app" || node.kind === "action.http";
  if (!isAction && /\{\{\s*secrets\./.test(JSON.stringify(node.config))) {
    return "Secrets can only be used in app actions and HTTP requests.";
  }

  switch (node.kind) {
    case "action.app": {
      const { toolkit, tool, version } = node.config;
      return toolkit && tool && version ? null : "Choose an app and an action.";
    }
    case "action.http":
      return node.config.url ? null : "Enter a URL.";
    case "ai.bot":
      if (!node.config.botId) return "Choose the bot that does this step.";
      return node.config.prompt.trim() ? null : "Say what the bot should do.";
    case "trigger.app":
      return node.config.toolkit && node.config.trigger
        ? null
        : "Choose an app and the event that starts this workflow.";
    case "logic.if":
    case "logic.filter":
      return node.config.conditions.length > 0 || node.config.groups.some((g) => g.conditions.length > 0) ? null : "Add at least one condition.";
    case "ai.decide":
      return decideIssue(node.config);
    case "trigger.webhook":
      return node.config.auth !== "none" && !node.config.secretName
        ? "Choose the secret callers must send (or sign with)."
        : null;
    case "logic.format":
      return node.config.input.trim() ? null : "Choose the value to format.";
    case "trigger.manual": {
      // A graph saved before forms existed has no fields list until it is parsed with the defaults.
      const keys = (node.config.fields ?? []).map((f) => f.key);
      return new Set(keys).size === keys.length ? null : "Two form fields have the same name.";
    }
    case "action.code":
      return node.config.code.trim() ? null : "Write the code to run.";
    case "logic.merge":
      if (node.config.inputs.filter((i) => i.trim()).length < 2) return "Choose at least two values to merge.";
      return node.config.mode === "by_key" && !node.config.key.trim() ? "Name the field both lists share (the key)." : null;
    case "logic.list":
      if (!node.config.input.trim()) return "Choose the list.";
      return NEEDS_FIELD.has(node.config.operation) && !node.config.field.trim() ? "Name the field of each item to use." : null;
    case "logic.switch":
      if (node.config.rules.length === 0) return "Add at least one rule.";
      if (new Set(node.config.rules.map((r) => r.id)).size !== node.config.rules.length) return "Two rules have the same name.";
      return node.config.rules.some((r) => r.conditions.length === 0) ? "Every rule needs at least one condition." : null;
    case "logic.loop":
      return node.config.items.trim() ? null : "Choose the list to go through.";
    case "logic.delay":
      if (node.config.mode === "until") return node.config.until.trim() ? null : "Choose the date and time to wait until.";
      if (node.config.mode === "next") {
        if (node.config.days.length === 0) return "Pick at least one day.";
        return isTimeZone(node.config.timezone) ? null : "Choose a valid time zone.";
      }
      return delaySeconds(node) > LIMITS.maxDelaySeconds ? "A delay can be at most 7 days." : null;
    case "trigger.schedule":
      return scheduleIssue(node.config, LIMITS.minScheduleMinutes);
    default:
      return null;
  }
}

/** A fixed delay's length; one that waits for a date counts as nothing here (the run checks its 7 days). */
function delaySeconds(node: Extract<WorkflowNode, { kind: "logic.delay" }>) {
  if (node.config.mode !== "for") return 0;
  return node.config.amount * DELAY_SECONDS[node.config.unit];
}

/** The blocks a run can reach from `start`. */
function reachableFrom(g: WorkflowGraph, start: string): Set<string> {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const e of g.edges) {
      if (e.source !== id || seen.has(e.target)) continue;
      seen.add(e.target);
      stack.push(e.target);
    }
  }
  return seen;
}
