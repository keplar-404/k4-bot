import { tool } from "langchain";
import { z } from "zod";
import { formatBytes, isInline, loadFile } from "../../../files";
import { type FileToolsOptions, MAX_VIEW_BYTES, MAX_VIEW_IMAGES, toDataUrl } from "./options";

export const createViewImage = (o: FileToolsOptions) =>
  tool(
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
