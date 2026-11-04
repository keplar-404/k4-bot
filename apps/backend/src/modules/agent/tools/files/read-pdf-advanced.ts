import { tool } from "langchain";
import { z } from "zod";
import { loadFile, readPdfAdvanced } from "../../../files";
import { type FileToolsOptions, MAX_VIEW_BYTES, MAX_VIEW_IMAGES, toDataUrl } from "./options";

export const createReadPdfAdvanced = (o: FileToolsOptions) =>
  tool(
    async ({ file_id, pages }) => {
      if (o.pdfOcr === "off") return "NOT DONE: advanced PDF reading is turned off on this server.";
      const file = await loadFile(o.bucket, o.db, o.userId, file_id);
      if (!file) return "NOT DONE: no such file.";
      if (file.row.mimeType !== "application/pdf") return `NOT DONE: "${file.row.name}" is not a PDF.`;
      const result = await readPdfAdvanced(
        {
          bucket: o.bucket,
          db: o.db,
          userId: o.userId,
          apiKey: o.openrouterApiKey,
          vision: o.vision,
          maxImages: MAX_VIEW_IMAGES,
          ocr: o.pdfOcr,
          maxOcrPagesPerDay: o.maxOcrPagesPerDay,
          usage: { threadId: o.threadId, runId: o.runId },
        },
        file,
        pages,
      );
      const fits = result.images.filter((i: { bytes: Uint8Array }) => i.bytes.byteLength <= MAX_VIEW_BYTES);
      if (fits.length) {
        const names = new Set(fits.map((i: { name: string }) => i.name));
        o.view.images = [...o.view.images.filter((i: { name: string }) => !names.has(i.name)), ...fits.map((i: { name: string; mimeType: string; bytes: Uint8Array }) => ({ name: i.name, dataUrl: toDataUrl(i.mimeType, i.bytes) }))].slice(-MAX_VIEW_IMAGES);
      }
      const tooBig = result.images.length - fits.length;
      return tooBig ? `${result.text}\n[${tooBig} picture(s) were too large to show.]` : result.text;
    },
    {
      name: "read_pdf_advanced",
      description:
        "Read a PDF with Mistral OCR (paid, ~$0.002/page): exact layout, tables and math. Use only after read_document flagged the PDF as complex, or the user asked for exact layout/math. Costs money; capped per user per day.",
      schema: z.object({
        file_id: z.string().describe("The file id."),
        pages: z.string().max(100).optional().describe('Pages to read, e.g. "1-5" or "2,7-9". Default: from the start. Max 10 pages per call.'),
      }),
    },
  );