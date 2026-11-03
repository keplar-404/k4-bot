import { tool } from "langchain";
import { z } from "zod";
import { agentUsage } from "../../../../db/schema";
import { extensionFor, IMAGE_USAGE_PREFIX, imagesToday, loadFile, safeName, saveFile } from "../../../files";
import { fileMarker } from "../../parts";
import { requestImage } from "./image-api";
import { describeFile, type FileToolsOptions, toDataUrl } from "./options";

export const createGenerateImage = (o: FileToolsOptions) =>
  tool(
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

      const image = await requestImage({ apiKey: o.openrouterApiKey, model: o.imageModel, prompt, aspectRatio: aspect_ratio, references });
      // Counted as soon as it is billed, before anything else can fail.
      await o.db.insert(agentUsage).values({ userId: o.userId, threadId: o.threadId, runId: o.runId, model: `${IMAGE_USAGE_PREFIX}${o.imageModel}` });

      const base = safeName(name ?? "", "image").replace(/\.[a-z0-9]+$/i, "");
      const file = await saveFile(o.bucket, o.db, { maxStorageBytes: o.maxStorageBytes }, {
        userId: o.userId,
        botId: o.botId,
        threadId: o.threadId,
        source: "generated",
        name: `${base}.${extensionFor(image.mimeType)}`,
        mimeType: image.mimeType,
        bytes: Buffer.from(image.base64, "base64"),
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
