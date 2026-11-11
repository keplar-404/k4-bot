import { z } from "zod";

export const MAX_MESSAGE_CHARS = 8000;
export const MAX_FILES = 5;
/** Tool calls in one slice of a run (a slice is one agent invocation): enough to build a 50-block workflow. */
export const MAX_TOOL_CALLS_PER_SLICE = 120;

const id = z.uuid();

/** A message to the assistant: what the route accepts (POST /assistant/threads/:id/messages). */
export const messageBody = z.object({
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  fileIds: z.array(id).max(MAX_FILES).default([]),
  /** The workflow page the user writes from: the assistant works on this one. */
  workflowId: id,
  modelId: z.string().max(120).optional(),
  files: z
    .array(z.object({ id, name: z.string().max(200), mimeType: z.string().max(120) }))
    .max(MAX_FILES)
    .default([]),
});
