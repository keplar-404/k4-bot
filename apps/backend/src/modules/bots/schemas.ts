import { z } from "zod";
import { SHAPE_IDS, COLOR_IDS, EXPRESSION_IDS } from "./bloub-ids";
import { DEFAULT_ROLE, MAX_ROLE_TITLE, ROLE_IDS } from "./roles";
import { MAX_PARALLEL_TOOLS, MAX_SUBAGENTS } from "../agent/domains/types";

export const createBotSchema = z
  .object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  role: z.enum(ROLE_IDS).optional().default(DEFAULT_ROLE),
  /** Only for the "custom" role. */
  roleTitle: z.string().trim().max(MAX_ROLE_TITLE).optional(),
  shape: z.enum(SHAPE_IDS),
  color: z.enum(COLOR_IDS),
  expression: z.enum(EXPRESSION_IDS),
  /** Installed skills (user_skill ids) the bot uses. Omitted = unchanged. */
  skillIds: z.array(z.string().min(1).max(64)).max(50).optional(),
  /** Connected apps (user_mcp_server ids) the bot may use. Omitted = unchanged. */
  mcpServerIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  /** Capabilities. Omitted on create = the role's defaults; omitted on edit = unchanged. */
  subagentsEnabled: z.boolean().optional(),
  maxSubagents: z.number().int().min(1).max(MAX_SUBAGENTS).optional(),
  maxParallelTools: z.number().int().min(1).max(MAX_PARALLEL_TOOLS).optional(),
  })
  .refine((b) => b.role !== "custom" || Boolean(b.roleTitle), { message: "Name the custom role", path: ["roleTitle"] })
  // A title belongs to the custom role only: switching to a preset clears it.
  .transform((b) => ({ ...b, roleTitle: b.role === "custom" ? b.roleTitle : null }));

export type CreateBotInput = z.infer<typeof createBotSchema>;

/** The model (and reasoning level) the user picked in the prompt bar. Checked against the catalog by the route. */
export const setBotModelSchema = z.object({
  modelId: z.string().min(1).max(200),
  reasoningEffort: z.string().min(1).max(32).nullable(),
});
