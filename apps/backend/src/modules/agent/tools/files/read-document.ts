import { tool } from "langchain";
import { z } from "zod";
import { canRead, loadFile, readDocument } from "../../../files";
import { type FileToolsOptions, MAX_VIEW_BYTES, MAX_VIEW_IMAGES, toDataUrl } from "./options";

/**
 * Reads a stored PDF or text file (one the user attached, the bot created, or shared from the computer).
 * Text comes back in the tool result; scanned pages and requested figures are shown to the model like attached
 * images (vision models), never saved in the conversation. See files/documents.ts for the cost tiers.
 */
export const createReadDocument = (o: FileToolsOptions) =>
  tool(
    async ({ file_id, pages, images }) => {
      const file = await loadFile(o.bucket, o.db, o.userId, file_id);
      if (!file) return "NOT DONE: no such file.";
      if (!canRead(file.row.mimeType)) return `NOT DONE: "${file.row.name}" is ${file.row.mimeType}; read_document reads PDFs, text and office files.${o.vision ? " Use view_image for pictures." : ""}`;
      const result = await readDocument(
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
        { pages, images },
      );
      const fits = result.images.filter((i) => i.bytes.byteLength <= MAX_VIEW_BYTES);
      if (fits.length) {
        // Shown on the next model calls of this run, like images the user attached (view-middleware.ts).
        const names = new Set(fits.map((i) => i.name));
        o.view.images = [...o.view.images.filter((i) => !names.has(i.name)), ...fits.map((i) => ({ name: i.name, dataUrl: toDataUrl(i.mimeType, i.bytes) }))].slice(-MAX_VIEW_IMAGES);
      }
      const tooBig = result.images.length - fits.length;
      return tooBig ? `${result.text}\n[${tooBig} picture(s) were too large to show.]` : result.text;
    },
    {
      name: "read_document",
      description:
        "Read a PDF, text or office file (docx, xlsx, pptx, odt, ods, csv, md, txt, json, html, xml) by its file id: returns the text page by page. " +
        "Scanned pages (no text layer) come back as pictures attached for you to read. Pass images: true to also see the charts, diagrams and formulas drawn as pictures on those pages. " +
        "Long documents are returned in parts: ask for the pages you need (\"1-10\", \"12,15\") and continue where it says. Read before you answer questions about a document; quote page numbers.",
      schema: z.object({
        file_id: z.string().describe("The file id."),
        pages: z.string().max(100).optional().describe('Pages to read, e.g. "1-5" or "2,7-9". Default: from the start.'),
        images: z.boolean().optional().describe("Also attach the pictures on these pages (figures, charts, formulas)."),
      }),
    },
  );
