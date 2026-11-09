import { z } from "zod";

/** A value that may hold `{{ references }}`, filled in when the run reaches the block. */
const template = (max: number) => z.string().max(max);

/** Items one For each may go through, and block runs it may cause (items × blocks after it). */
export const LOOP_LIMITS = { items: 100, blockRuns: 300 } as const;

/**
 * For each: the blocks after it run once per item of a list (Zapier's "Looping"). `items` is a reference to a list,
 * such as {{steps.sheets_1.output.data.rows}}; inside the loop, {{loop.item}}, {{loop.index}} and {{loop.count}} read
 * the current item. Lists longer than `max` are cut to it.
 */
export const loopConfig = z.object({
  items: template(4000).default(""),
  max: z.number().int().min(1).max(LOOP_LIMITS.items).default(50),
});

/**
 * Ask me first: the run waits until the user approves or declines in the builder. Declined stops the path after it
 * (like a Filter); no answer within `timeoutHours` fails the block.
 */
export const approvalConfig = z.object({
  message: template(2000).default(""),
  timeoutHours: z.number().int().min(1).max(168).default(24),
  /** With no answer in time: fail the block (the run fails), or treat it as declined (the run goes on, that path stops). */
  onTimeout: z.enum(["fail", "decline"]).default("fail"),
});
