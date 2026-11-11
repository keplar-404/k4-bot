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
import { codeConfig } from "./code-block";
import { decideConfig } from "./decide-block";
import { aiConfig, appTriggerConfig } from "./event-ai-blocks";
import { approvalConfig, loopConfig } from "./flow-blocks";
import { formatConfig } from "./format-block";
import { manualConfig } from "./manual-form";
import { listConfig, mergeConfig } from "./list-blocks";
import { switchConfig } from "./switch-block";
import { webhookConfig } from "./webhook-config";

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
  z.object({ ...base, kind: z.literal("trigger.manual"), config: manualConfig.prefault({}) }),
  z.object({ ...base, kind: z.literal("trigger.schedule"), config: scheduleConfig }),
  z.object({ ...base, kind: z.literal("trigger.webhook"), config: webhookConfig.prefault({}) }),
  z.object({ ...base, kind: z.literal("trigger.app"), config: appTriggerConfig }),
  z.object({ ...base, kind: z.literal("action.app"), config: appConfig, ...outside }),
  z.object({ ...base, kind: z.literal("action.http"), config: httpConfig, ...outside }),
  z.object({ ...base, kind: z.literal("action.code"), config: codeConfig, ...outside }),
  z.object({ ...base, kind: z.literal("logic.if"), config: conditionsConfig }),
  z.object({ ...base, kind: z.literal("logic.filter"), config: conditionsConfig }),
  z.object({ ...base, kind: z.literal("logic.delay"), config: delayConfig }),
  z.object({ ...base, kind: z.literal("logic.set"), config: setConfig }),
  /** The workflow's answer: what a bot that ran it gets back (run_workflow's `result`). Same settings as Set fields. */
  z.object({ ...base, kind: z.literal("logic.return"), config: setConfig }),
  z.object({ ...base, kind: z.literal("ai.bot"), config: aiConfig, ...outside }),
  z.object({ ...base, kind: z.literal("ai.decide"), config: decideConfig, ...outside }),
  z.object({ ...base, kind: z.literal("logic.switch"), config: switchConfig }),
  z.object({ ...base, kind: z.literal("logic.format"), config: formatConfig }),
  z.object({ ...base, kind: z.literal("logic.merge"), config: mergeConfig }),
  z.object({ ...base, kind: z.literal("logic.list"), config: listConfig }),
  z.object({ ...base, kind: z.literal("logic.loop"), config: loopConfig }),
  z.object({ ...base, kind: z.literal("logic.approval"), config: approvalConfig }),
]);

/** A connection. From an If block `branch` says which way ("true" / "false"); from a Switch, which rule (or "otherwise"). */
export const edgeSchema = z.object({
  id,
  source: id,
  target: id,
  branch: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/)
    .optional(),
});

/** Pinned sample outputs: at most this much JSON in all. */
export const MAX_PINS_BYTES = 256 * 1024;

export const graphSchema = z.object({
  nodes: z.array(nodeSchema).max(LIMITS.nodes),
  edges: z.array(edgeSchema).max(LIMITS.edges),
  /**
   * Pinned sample outputs by block id (n8n's pin data): test runs use them instead of running those blocks, so later
   * blocks can be tried without calling apps again. Draft only: publishing drops them; live runs never read them.
   */
  pins: z
    .record(id, z.unknown())
    .refine((p) => JSON.stringify(p).length <= MAX_PINS_BYTES, "Pinned data is too large (256 KB in all).")
    .optional(),
  /** A test run's "Test this step": only this block and the blocks it needs run. Set on the run's copy, never saved. */
  stopAfter: id.optional(),
});

/** What goes live (and what a non-test run may use): the graph without draft-only data. */
export const liveGraph = ({ pins: _pins, stopAfter: _stop, ...g }: WorkflowGraph): WorkflowGraph => g;

export type WorkflowNode = z.infer<typeof nodeSchema>;
export type WorkflowEdge = z.infer<typeof edgeSchema>;
export type WorkflowGraph = z.infer<typeof graphSchema>;
export type NodeKind = WorkflowNode["kind"];
export type Condition = z.infer<typeof conditionSchema>;
export const isTrigger = (n: { kind: string }) => n.kind.startsWith("trigger.");
