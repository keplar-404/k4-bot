import { PDFDocument } from "pdf-lib";
import { pictures, toWebImage } from "./pdf-pictures";

export interface PageImage {
  page: number;
  mimeType: "image/jpeg" | "image/png";
  bytes: Uint8Array;
  width: number;
  height: number;
}

export async function extractPageImages(
  pdf: PDFDocument,
  pages: number[],
  limit: number,
): Promise<{ images: PageImage[]; skipped: number[] }> {
  const images: PageImage[] = [];
  const skipped = new Set<number>();
  for (const pageNo of pages) {
    for (const { stream, width, height } of pictures(pdf, pageNo)) {
      if (images.length >= limit) return { images, skipped: [...skipped] };
      const image = await toWebImage(pdf, stream.dict, stream.contents, width, height);
      if (image) images.push({ page: pageNo, width, height, ...image });
      else skipped.add(pageNo);
    }
  }
  return { images, skipped: [...skipped] };
}

export function countPageImages(pdf: PDFDocument, pages: number[]): Map<number, number> {
  return new Map(pages.map((p) => [p, pictures(pdf, p).length]));
}

export const loadPdf = (bytes: Uint8Array) => PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });