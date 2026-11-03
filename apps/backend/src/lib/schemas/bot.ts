import { z } from "zod";
import { SHAPE_IDS, COLOR_IDS, EXPRESSION_IDS } from "../bloub-ids";

export const createBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  shape: z.enum(SHAPE_IDS),
  color: z.enum(COLOR_IDS),
  expression: z.enum(EXPRESSION_IDS),
});

export type CreateBotInput = z.infer<typeof createBotSchema>;

/** The model (and reasoning level) the user picked in the prompt bar. Checked against the catalog by the route. */
export const setBotModelSchema = z.object({
  modelId: z.string().min(1).max(200),
  reasoningEffort: z.string().min(1).max(32).nullable(),
});
