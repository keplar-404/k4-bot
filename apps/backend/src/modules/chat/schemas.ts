import { z } from "zod";

export const createThreadSchema = z.object({
  botId: z.string().min(1),
  title: z.string().max(200).optional(),
});

export const sendMessageSchema = z
  .object({
  /** Client-generated; makes a retried send idempotent. */
  messageId: z.uuid().optional(),
  /** Re-ask a message whose answer failed: starts a new run for the same message. */
  retry: z.boolean().optional(),
  /** May be empty when files are attached. */
  content: z.string().max(32_000),
  /** Files uploaded beforehand with POST /files. */
  fileIds: z.array(z.uuid()).max(10).optional(),
  /** Model id from GET /api/v1/models; omit for the catalog default. */
  modelId: z.string().min(1).max(200).optional(),
  /** One of the model's reasoningEfforts, when it supports reasoning. */
  reasoningEffort: z.string().min(1).max(32).optional(),
  /** /compact: summarize the conversation to free context (the content is "/compact"). */
  compact: z.boolean().optional(),
  })
  .refine((m) => m.content.trim().length > 0 || (m.fileIds?.length ?? 0) > 0, { message: "Write a message or attach a file", path: ["content"] });

/**
 * Answer to a paused run: HITL decisions (mirrors LangChain's `Decision`, one per paused action)
 * or the text answer to an `ask_user` question.
 */
export const resumeRunSchema = z.union([
  z.object({
    threadId: z.string().min(1),
    decisions: z
      .array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("approve") }),
          z.object({ type: z.literal("reject"), message: z.string().max(2000).optional() }),
          z.object({
            type: z.literal("edit"),
            editedAction: z.object({ name: z.string(), args: z.record(z.string(), z.json()) }),
          }),
        ]),
      )
      .min(1),
  }),
  z.object({ threadId: z.string().min(1), answer: z.string().max(8000) }),
]);
