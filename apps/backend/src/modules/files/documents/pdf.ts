import { PDFDocument } from "pdf-lib";
import { countPageImages, extractPageImages, loadPdf } from "./pdf-images";
import { chunkText } from "./pdf-text";
import { ocrPages, ocrPagesToday } from "./ocr";
import { parsePages, ranges, letters } from "./pages";
import { assessComplexity } from "./complexity";
import { pdfAnswer } from "./pdf-answer";
import type { ReadOptions, ReadResult, StoredFile, ReadRequest } from "./types";

const MIN_TEXT = 25;

/** Reads a PDF through the 3-tier pipeline: free text → pictures → OCR. */
export async function readPdf(o: ReadOptions, file: StoredFile, request: ReadRequest): Promise<ReadResult> {
  let pdf: PDFDocument;
  try {
    pdf = await loadPdf(file.bytes);
  } catch {
    return { text: `NOT DONE: "${file.row.name}" is not a readable PDF (it may be damaged or password-protected).`, images: [] };
  }
  const total = pdf.getPageCount();
  const wanted = parsePages(request.pages, total);
  if (wanted.length === 0) return { text: `NOT DONE: "${file.row.name}" has ${total} pages; ask for pages between 1 and ${total}.`, images: [] };

  const texts = new Map<number, string>();
  const failures: string[] = [];
  const shown: number[] = [];
  let used = 0;
  for (const p of wanted) {
    if (!texts.has(p) && !failures.length) {
      const k = Math.floor((p - 1) / 20);
      const piece = await chunkText(o, file, pdf, k, total);
      if (!piece.ok) failures.push(piece.error);
      else piece.pages.forEach((t, i) => texts.set(k * 20 + i + 1, t));
    }
    const len = (texts.get(p) ?? "").length;
    if (shown.length && used + len > 24_000) break;
    shown.push(p);
    used += len;
  }
  if (failures.length && texts.size === 0) return { text: `NOT DONE: could not read "${file.row.name}": ${failures[0]}.`, images: [] };
  const scans = shown.filter((p) => letters(texts.get(p)) < MIN_TEXT);

  const images: ReadResult["images"] = [];
  const pictured = new Set<number>();
  let unreadable = scans;
  if (o.vision) {
    const target = request.images ? shown : scans;
    const { images: found } = await extractPageImages(pdf, target, o.maxImages);
    found.forEach((img, i) => {
      pictured.add(img.page);
      images.push({ name: `${file.row.name} p${img.page}${i ? `-${i + 1}` : ""}`, mimeType: img.mimeType, bytes: img.bytes });
    });
    unreadable = scans.filter((p) => !pictured.has(p));
  }

  const ocrResult = unreadable.length
    ? (o.ocr === "off"
        ? { texts: new Map<number, string>(), note: "OCR is turned off on this server." }
        : await ocrPages(o, file, pdf, unreadable))
    : { texts: new Map<number, string>(), note: "" };
  const ocrd = ocrResult.texts;
  const ocrNote = ocrResult.note;

  const figures = countPageImages(pdf, shown);
  const complexity = assessComplexity({ texts, shown, scans, figures });
  const text = pdfAnswer({
    name: file.row.name,
    total,
    wanted,
    shown,
    texts,
    scans,
    pictured,
    ocrd,
    ocrNote,
    figures,
    failures,
    images,
    maxImages: o.maxImages,
    requestPages: request.pages,
    complex: complexity.complex,
    complexityReasons: complexity.reasons,
  });
  return { text, images };
}