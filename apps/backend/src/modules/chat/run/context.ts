import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { bot, chatFile, userMcpServer, userSkill } from "../../../db/schema";
import type { Env } from "../../../config/env";
import type { BuildAgentOptions } from "../../agent/agent";
import { DEFAULT_MODEL_ID, resolveModel } from "../../agent/models";
import type { FileRef, SubagentStatus } from "../../agent/parts";
import { MAX_VIEW_BYTES, MAX_VIEW_IMAGES, toDataUrl } from "../../agent/tools/files";
import type { GroupHub } from "../../agent/tools/subagents";
import { isInline } from "../../files";
import { catalogMcp } from "../../integrations/catalog/mcp";
import type { ChatRunParams, Publish } from "./types";

/** The user's other bots, so the prompt can say where their files are (one small query, no E2B call). */
export const peersOf = (db: Db, userId: string, botId: string) =>
  db.select({ id: bot.id, name: bot.name }).from(bot).where(and(eq(bot.userId, userId), sql`${bot.id} <> ${botId}`));

/** Attached images are shown to a vision model during the whole run (read again per slice: R2 only, no third party). */
export async function attachedImages(env: Env, db: Db, params: ChatRunParams, attached: FileRef[]) {
  const images: Array<{ name: string; dataUrl: string }> = [];
  if (!env.FILES || !resolveModel(params.modelId ?? DEFAULT_MODEL_ID)?.vision) return images;
  for (const f of attached.filter((f) => isInline(f.mimeType) && f.size <= MAX_VIEW_BYTES).slice(0, MAX_VIEW_IMAGES)) {
    const [row] = await db.select({ key: chatFile.storageKey }).from(chatFile).where(and(eq(chatFile.id, f.id), eq(chatFile.userId, params.userId)));
    const object = row ? await env.FILES.get(row.key) : null;
    if (object) images.push({ name: f.name, dataUrl: toDataUrl(f.mimeType, new Uint8Array(await object.arrayBuffer())) });
  }
  return images;
}

/** A bot that spawns sub-agents may give them any skill or app the user installed (two small queries, no third party). */
export async function subagentContext(
  env: Env,
  db: Db,
  params: ChatRunParams,
  live: { publish: Publish; hub: GroupHub; sliceDeadline: number; progress: Map<string, SubagentStatus[]> },
): Promise<NonNullable<BuildAgentOptions["subagents"]>> {
  const { userId, threadId, runId } = params;
  const [installedSkills, connected] = await Promise.all([
    db
      .select({ name: userSkill.name, skillId: userSkill.skillId, storageKey: userSkill.storageKey, description: userSkill.description })
      .from(userSkill)
      .where(eq(userSkill.userId, userId)),
    db
      .select({ id: userMcpServer.id, serverId: userMcpServer.serverId, secrets: userMcpServer.secrets })
      .from(userMcpServer)
      .where(eq(userMcpServer.userId, userId)),
  ]);
  return {
    env,
    db,
    userId,
    threadId,
    runId,
    installedSkills,
    connectedApps: connected.flatMap((r) => {
      const entry = catalogMcp(r.serverId);
      return entry ? [{ ...r, name: entry.name }] : [];
    }),
    // Live status of the group for the chat. The latest one is also kept, so the tool part saves it when it ends.
    report: (toolCallId: string, agents: SubagentStatus[]) => {
      live.progress.set(toolCallId, agents);
      return live.publish("tool.progress", { id: toolCallId, agents });
    },
    hub: live.hub,
    sliceDeadline: live.sliceDeadline,
  };
}

/** Image creation, view_image and file sharing, when file storage is configured. */
export const fileOptions = (env: Env, db: Db, params: ChatRunParams, attached: Array<{ name: string; dataUrl: string }>) =>
  env.FILES
    ? {
        bucket: env.FILES,
        db,
        userId: params.userId,
        threadId: params.threadId,
        runId: params.runId,
        imageModel: env.IMAGE_MODEL,
        maxImagesPerDay: env.MAX_IMAGES_PER_DAY,
        pdfOcr: env.PDF_OCR,
        maxOcrPagesPerDay: env.MAX_OCR_PAGES_PER_DAY,
        maxStorageBytes: env.MAX_STORAGE_MB_PER_USER * 1024 * 1024,
        attached,
      }
    : undefined;
