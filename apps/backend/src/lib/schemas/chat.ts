import { z } from "zod";

export const createThreadSchema = z.object({
  botId: z.string().min(1),
  title: z.string().max(200).optional(),
});

export const sendMessageSchema = z.object({
  /** Client-generated; makes a retried send idempotent. */
  messageId: z.uuid().optional(),
  /** Re-ask a message whose answer failed: starts a new run for the same message. */
  retry: z.boolean().optional(),
  content: z.string().min(1).max(32_000),
  /** Model id from GET /api/v1/models; omit for the catalog default. */
  modelId: z.string().min(1).max(200).optional(),
  /** One of the model's reasoningEfforts, when it supports reasoning. */
  reasoningEffort: z.string().min(1).max(32).optional(),
});

/** Mirrors LangChain's HITL `Decision` type, one entry per paused action. */
export const resumeRunSchema = z.object({
  threadId: z.string().min(1),
  decisions: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("approve") }),
        z.object({ type: z.literal("reject"), message: z.string().max(2000).optional() }),
        z.object({
          type: z.literal("edit"),
          editedAction: z.object({ name: z.string(), args: z.record(z.string(), z.unknown()) }),
        }),
      ]),
    )
    .min(1),
});
