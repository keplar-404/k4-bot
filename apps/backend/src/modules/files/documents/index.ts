export * from "./advanced";
export * from "./complexity";
export * from "./ocr";
export * from "./pages";
export * from "./pdf";
export * from "./pdf-answer";
export * from "./pdf-images";
export * from "./pdf-text";
export * from "./png";
export * from "./text";
export * from "./types";

import { canReadOffice, readOffice } from "./office";
import { readPdf } from "./pdf";
import { readText } from "./text";
import { notDone, type ReadOptions, type ReadRequest, type ReadResult, type StoredFile } from "./types";

/** Plain text formats (txt, md, csv, json, html, xml, code): read as they are, no conversion or cache. */
const TEXT_MIME = /^(text\/|application\/(json|xml)$)/;

export const canRead = (mimeType: string) => mimeType === "application/pdf" || TEXT_MIME.test(mimeType) || canReadOffice(mimeType);

/** read_document's entry: PDFs (three tiers, pdf.ts), Office documents (office/), plain text. */
export async function readDocument(o: ReadOptions, file: StoredFile, request: ReadRequest): Promise<ReadResult> {
  const mime = file.row.mimeType;
  if (mime === "application/pdf") return readPdf(o, file, request);
  if (canReadOffice(mime)) return readOffice(o.bucket, file, request.pages);
  if (TEXT_MIME.test(mime)) return readText(file.row.name, new TextDecoder().decode(file.bytes), request.pages);
  return notDone(`"${file.row.name}" is ${mime}; read_document reads PDFs, Office documents and text files.`);
}
