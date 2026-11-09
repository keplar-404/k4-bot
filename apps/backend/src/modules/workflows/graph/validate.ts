import { scheduleIssue } from "../../schedules/issues";
import { isTrigger, LIMITS, type WorkflowGraph, type WorkflowNode } from "./schema";
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
      return node.config.conditions.length > 0 ? null : "Add at least one condition.";
    case "logic.loop":
      return node.config.items.trim() ? null : "Choose the list to go through.";
    case "logic.delay":
      return delaySeconds(node) > LIMITS.maxDelaySeconds ? "A delay can be at most 7 days." : null;
    case "trigger.schedule":
      return scheduleIssue(node.config, LIMITS.minScheduleMinutes);
    default:
      return null;
  }
}

function delaySeconds(node: Extract<WorkflowNode, { kind: "logic.delay" }>) {
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
