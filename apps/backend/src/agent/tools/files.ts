import { tool } from "langchain";
import { z } from "zod";
import type { ComputerStub } from "../../computer/sandbox-backend";
import { shellQuote } from "../../computer/guards";
import type { Db } from "../../db";
import { agentUsage, chatFile } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  extensionFor,
  formatBytes,
  IMAGE_USAGE_PREFIX,
  imagesToday,
  isInline,
  loadFile,
  MAX_FILE_BYTES,
  safeName,
  saveFile,
} from "../../lib/files";
import { fileMarker, type FileRef } from "../parts";

/** Images the model looks at on its next calls (attached to the request only, never saved in the conversation). */
export interface ViewHolder {
  images: Array<{ name: string; dataUrl: string }>;
}

/** A model sees at most this many attached images at once, each at most this big. */
export const MAX_VIEW_IMAGES = 4;
export const MAX_VIEW_BYTES = 4 * 1024 * 1024;

export const toDataUrl = (mimeType: string, bytes: Uint8Array) => `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;

export interface FileToolsOptions {
  bucket: R2Bucket;
  db: Db;
  userId: string;
  botId: string;
  threadId: string;
  runId: string;
  openrouterApiKey: string;
  imageModel: string;
  maxImagesPerDay: number;
  maxStorageBytes: number;
  /** The model can look at images (offers view_image). */
  vision: boolean;
  view: ViewHolder;
  /** Present when the run may use the user's computer (offers copy_to_computer and share_file). */
  computer?: { stub: ComputerStub; home: string };
}

const describeFile = (f: FileRef) => `"${f.name}" (${f.mimeType}, ${formatBytes(f.size)}, file id ${f.id})`;

export function createFileTools(o: FileToolsOptions) {
  const limits = { maxStorageBytes: o.maxStorageBytes };

  const generateImage = tool(
    async ({ prompt, aspect_ratio, reference_file_ids, name }) => {
      if ((await imagesToday(o.db, o.userId)) >= o.maxImagesPerDay) {
        return `NOT DONE: the daily limit of ${o.maxImagesPerDay} images is reached. It resets at 00:00 UTC. Tell the user.`;
      }
      const references: string[] = [];
      for (const id of reference_file_ids ?? []) {
        const file = await loadFile(o.bucket, o.db, o.userId, id);
        if (!file || !file.row.mimeType.startsWith("image/")) return `NOT DONE: ${id} is not an image file of this user.`;
        references.push(toDataUrl(file.row.mimeType, file.bytes));
      }

      // https://openrouter.ai/docs/guides/overview/multimodal/image-generation
      const response = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST",
        headers: {
          authorization: `Bearer ${o.openrouterApiKey}`,
          "content-type": "application/json",
          "http-referer": "https://k4.bot",
          "x-title": "K4 Bot",
        },
        body: JSON.stringify({
          model: o.imageModel,
          prompt,
          n: 1,
          ...(aspect_ratio ? { aspect_ratio } : {}),
          ...(references.length ? { input_references: references } : {}),
        }),
        signal: AbortSignal.timeout(150_000),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: Array<{ b64_json?: string; media_type?: string }>;
        error?: { message?: string };
      } | null;
      const image = body?.data?.[0];
      if (!response.ok || !image?.b64_json) {
        throw new Error(`Image service error (${response.status}): ${body?.error?.message ?? "no image returned"}`.slice(0, 300));
      }
      // Counted as soon as it is billed, before anything else can fail.
      await o.db.insert(agentUsage).values({ userId: o.userId, threadId: o.threadId, runId: o.runId, model: `${IMAGE_USAGE_PREFIX}${o.imageModel}` });

      const mimeType = image.media_type?.startsWith("image/") ? image.media_type : "image/png";
      const base = safeName(name ?? "", "image").replace(/\.[a-z0-9]+$/i, "");
      const file = await saveFile(o.bucket, o.db, limits, {
        userId: o.userId,
        botId: o.botId,
        threadId: o.threadId,
        source: "generated",
        name: `${base}.${extensionFor(mimeType)}`,
        mimeType,
        bytes: Buffer.from(image.b64_json, "base64"),
        prompt,
      });
      return [
        `Created the image ${describeFile(file)}. The user sees it in the chat with a download button; do not paste a link.`,
        o.computer ? "To put it on the computer, use copy_to_computer." : "",
        fileMarker(file),
      ]
        .filter(Boolean)
        .join("\n");
    },
    {
      name: "generate_image",
      description:
        "Create an image from a text description, or edit/combine images by passing their file ids as references " +
        "(images the user attached or you created). The image is shown to the user in the chat and saved in their files. " +
        "Each image costs money: create one per request unless the user asks for more.",
      schema: z.object({
        prompt: z.string().min(3).max(4000).describe("A detailed description: subject, style, composition, colours, text to include."),
        aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]).optional().describe("Default 1:1."),
        reference_file_ids: z.array(z.string()).max(4).optional().describe("Images to edit or take style/content from."),
        name: z.string().max(80).optional().describe("Short file name without extension, e.g. 'sunset-poster'."),
      }),
    },
  );

  const viewImage = tool(
    async ({ file_id }) => {
      const file = await loadFile(o.bucket, o.db, o.userId, file_id);
      if (!file) return "NOT DONE: no such file.";
      if (!isInline(file.row.mimeType)) return `NOT DONE: "${file.row.name}" is not a PNG, JPEG, GIF or WebP image.`;
      if (file.bytes.byteLength > MAX_VIEW_BYTES) return `NOT DONE: the image is larger than ${formatBytes(MAX_VIEW_BYTES)}.`;
      o.view.images = [...o.view.images.filter((i) => i.name !== file.row.name), { name: file.row.name, dataUrl: toDataUrl(file.row.mimeType, file.bytes) }].slice(-MAX_VIEW_IMAGES);
      return `The image "${file.row.name}" is attached below.`;
    },
    {
      name: "view_image",
      description: "Look at a stored image (one the user attached, you created, or shared from the computer) by its file id.",
      schema: z.object({ file_id: z.string().describe("The file id.") }),
    },
  );

  const tools = [generateImage, ...(o.vision ? [viewImage] : [])];
  const computer = o.computer;
  if (!computer) return tools;

  const copyToComputer = tool(
    async ({ file_id, path }) => {
      const file = await loadFile(o.bucket, o.db, o.userId, file_id);
      if (!file) return "NOT DONE: no such file.";
      const target = !path ? `${computer.home}/files/${file.row.name}` : path.startsWith("/") ? path : `${computer.home}/${path.replace(/^~\/?/, "")}`;
      const [result] = await computer.stub.upload(o.botId, [[target, file.bytes]]);
      if (result?.error) {
        return result.error === "permission_denied"
          ? `NOT DONE: you can only write inside your own folder ${computer.home}.`
          : `NOT DONE: could not write ${target} (${result.error}).`;
      }
      await o.db.update(chatFile).set({ computerPath: target }).where(eq(chatFile.id, file.row.id));
      return `Copied "${file.row.name}" to ${target} on the computer (any older file there was replaced).`;
    },
    {
      name: "copy_to_computer",
      description:
        "Put a stored file (one the user attached or you created) on the computer, inside your own folder. " +
        "Default location: your folder's files/ subfolder. Use it before working on an attached file with the shell or apps.",
      schema: z.object({
        file_id: z.string().describe("The file id."),
        path: z.string().max(500).optional().describe(`Absolute path inside ${computer.home}, or relative to it. Default: files/<name>.`),
      }),
    },
  );

  const shareFile = tool(
    async ({ path }) => {
      const full = path.startsWith("/") ? path : `${computer.home}/${path.replace(/^~\/?/, "")}`;
      // Checked as this bot's own Linux user, like the read itself: other bots' files yes, private folders no.
      const stat = await computer.stub.exec(o.botId, `stat -L -c '%s %F' -- ${shellQuote(full)}`, 20_000);
      if (stat.exitCode !== 0) return `NOT DONE: ${stat.output.trim().slice(0, 200) || "cannot read that path"}`;
      const [size, ...kind] = stat.output.trim().split(" ");
      if (kind.join(" ") === "directory") {
        return "NOT DONE: that is a folder. Pack it first (e.g. `cd <parent> && zip -qr ~/<name>.zip <name>`, or tar -czf if zip is missing), then share the archive.";
      }
      if (Number(size) > MAX_FILE_BYTES) return `NOT DONE: the file is ${formatBytes(Number(size))}; the limit is ${formatBytes(MAX_FILE_BYTES)}. Compress or split it.`;
      const [read] = await computer.stub.download(o.botId, [full]);
      if (!read?.content) return `NOT DONE: cannot read ${full} (${read?.error ?? "unknown error"}).`;
      const file = await saveFile(o.bucket, o.db, limits, {
        userId: o.userId,
        botId: o.botId,
        threadId: o.threadId,
        source: "computer",
        name: full.split("/").pop() ?? "file",
        bytes: read.content,
        computerPath: full,
      });
      return [
        `Shared ${describeFile(file)} with the user. They see a download button in the chat (a copy as of now; it works while the computer sleeps). Do not paste a link.`,
        fileMarker(file),
      ].join("\n");
    },
    {
      name: "share_file",
      description:
        "Give the user a file from the computer: it appears in the chat with a download button and stays in their files. " +
        "Works for your files and other bots' files. For a folder, zip it first.",
      schema: z.object({ path: z.string().min(1).max(500).describe("Absolute path of the file on the computer.") }),
    },
  );

  return [...tools, copyToComputer, shareFile];
}
