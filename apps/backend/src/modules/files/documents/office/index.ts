import { readText } from "../text";
import { notDone, type ReadResult, type StoredFile } from "../types";
import { readCache, writeCache } from "./cache";
import { docxToMarkdown } from "./docx";
import { openDocumentToMarkdown } from "./opendocument";
import { pptxToMarkdown } from "./pptx";
import { xlsxToMarkdown } from "./xlsx";

const OOXML = "application/vnd.openxmlformats-officedocument.";

/** Office formats read_document converts to text, by mime type. */
const CONVERTERS: Record<string, (bytes: Uint8Array) => Promise<string>> = {
  [`${OOXML}wordprocessingml.document`]: docxToMarkdown,
  [`${OOXML}spreadsheetml.sheet`]: xlsxToMarkdown,
  [`${OOXML}presentationml.presentation`]: pptxToMarkdown,
  "application/vnd.oasis.opendocument.text": (b) => openDocumentToMarkdown(b, false),
  "application/vnd.oasis.opendocument.spreadsheet": (b) => openDocumentToMarkdown(b, true),
};

/** Old binary Office formats: not zips of XML, so they cannot be read here. */
const LEGACY: Record<string, string> = {
  "application/msword": ".docx",
  "application/vnd.ms-excel": ".xlsx",
  "application/vnd.ms-powerpoint": ".pptx",
};

export const canReadOffice = (mimeType: string) => mimeType in CONVERTERS || mimeType in LEGACY;

/** An Office document as paged text; converted once, then read from the R2 cache. A bad file is a NOT DONE, never a crash. */
export async function readOffice(bucket: R2Bucket, file: StoredFile, pages?: string): Promise<ReadResult> {
  const mime = file.row.mimeType;
  if (LEGACY[mime]) return notDone(`"${file.row.name}" uses an old Office format; ask the user to save it as ${LEGACY[mime]} and upload it again.`);
  try {
    let markdown = await readCache(bucket, file);
    if (markdown === null) {
      markdown = await CONVERTERS[mime]!(file.bytes);
      await writeCache(bucket, file, markdown);
    }
    if (!markdown.trim()) return notDone(`"${file.row.name}" has no text to read (it may contain only pictures).`);
    return readText(file.row.name, markdown, pages);
  } catch (error) {
    return notDone(`could not read "${file.row.name}" (${error instanceof Error ? error.message : String(error)}); it may be damaged or password-protected.`);
  }
}
