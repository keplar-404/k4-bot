import { z } from "zod";
import {
  appConfig,
  conditionsConfig,
  type conditionSchema,
  delayConfig,
  httpConfig,
  LIMITS,
  retrySchema,
  scheduleConfig,
  setConfig,
} from "./blocks";
import { aiConfig, appTriggerConfig } from "./event-ai-blocks";
import { approvalConfig, loopConfig } from "./flow-blocks";

export { conditionSchema, LIMITS, retrySchema } from "./blocks";

/**
 * A workflow is a graph of blocks (nodes) joined by edges, saved as JSON and validated here on every save. The web
 * builder imports these types, so both sides speak the same shape. Each block's settings are in blocks.ts.
 */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const empty = z.object({}).default({});
const base = {
  id,
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  label: z.string().max(80).optional(),
};
/** Blocks that call the outside world can retry, and can let the run go on when they fail. */
const outside = { retry: retrySchema.optional(), onError: z.enum(["stop", "continue"]).default("stop") };

export const nodeSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("trigger.manual"), config: empty }),
  z.object({ ...base, kind: z.literal("trigger.schedule"), config: scheduleConfig }),
  z.object({ ...base, kind: z.literal("trigger.webhook"), config: empty }),
  z.object({ ...base, kind: z.literal("trigger.app"), config: appTriggerConfig }),
  z.object({ ...base, kind: z.literal("action.app"), config: appConfig, ...outside }),
  z.object({ ...base, kind: z.literal("action.http"), config: httpConfig, ...outside }),
  z.object({ ...base, kind: z.literal("logic.if"), config: conditionsConfig }),
  z.object({ ...base, kind: z.literal("logic.filter"), config: conditionsConfig }),
  z.object({ ...base, kind: z.literal("logic.delay"), config: delayConfig }),
  z.object({ ...base, kind: z.literal("logic.set"), config: setConfig }),
  z.object({ ...base, kind: z.literal("ai.bot"), config: aiConfig, ...outside }),
  z.object({ ...base, kind: z.literal("logic.loop"), config: loopConfig }),
  z.object({ ...base, kind: z.literal("logic.approval"), config: approvalConfig }),
]);

/** A connection. From an If block, `branch` says which way ("true" / "false"). */
export const edgeSchema = z.object({
  id,
  source: id,
  target: id,
  branch: z.enum(["true", "false"]).optional(),
});

export const graphSchema = z.object({
  nodes: z.array(nodeSchema).max(LIMITS.nodes),
  edges: z.array(edgeSchema).max(LIMITS.edges),
});

export type WorkflowNode = z.infer<typeof nodeSchema>;
export type WorkflowEdge = z.infer<typeof edgeSchema>;
export type WorkflowGraph = z.infer<typeof graphSchema>;
export type NodeKind = WorkflowNode["kind"];
export type Condition = z.infer<typeof conditionSchema>;
export const isTrigger = (n: { kind: string }) => n.kind.startsWith("trigger.");
