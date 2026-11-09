import { z } from "zod";
import { conditionSchema, LIMITS } from "./blocks";

/** The output a Switch takes when no rule matches (when enabled). */
export const OTHERWISE = "otherwise";

const route = z.string().regex(/^[a-z0-9_]{1,30}$/).refine((v) => v !== OTHERWISE, "That name is reserved.");

/**
 * Switch (n8n's Switch, Zapier's Paths): rules are checked in order and the first that matches picks its output; with
 * none matching, the "otherwise" output (when on). Each rule is a set of conditions, all or any of which must hold.
 * A connection from a Switch carries the rule's `id` (or "otherwise") as its branch.
 */
export const switchConfig = z.object({
  rules: z
    .array(
      z.object({
        id: route,
        label: z.string().max(60).default(""),
        combine: z.enum(["all", "any"]).default("all"),
        conditions: z.array(conditionSchema).max(LIMITS.conditions),
      }),
    )
    .max(10),
  otherwise: z.boolean().default(true),
});

export type SwitchConfig = z.infer<typeof switchConfig>;
