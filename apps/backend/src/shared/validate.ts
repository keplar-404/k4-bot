import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";

/**
 * zValidator with the API's standard 400 body. `Target` stays a literal type so
 * the typed client infers exactly one input (`json`, `query` or `param`).
 */
export const validate = <Target extends keyof ValidationTargets, T extends z.ZodType>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "INVALID_INPUT", details: z.flattenError(result.error) }, 400);
    }
  });
