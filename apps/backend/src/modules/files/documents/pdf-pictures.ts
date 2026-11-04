import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, type PDFRef } from "pdf-lib";
import { png } from "./png";

const MIN_SIDE = 120;

export function pictures(pdf: PDFDocument, pageNo: number): Array<{ stream: PDFRawStream; width: number; height: number }> {
  const page = pdf.getPages()[pageNo - 1];
  const xobjects = page?.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!xobjects) return [];
  const found: Array<{ stream: PDFRawStream; width: number; height: number }> = [];
  for (const ref of xobjects.values()) {
    const stream = pdf.context.lookup(ref as PDFRef);
    if (!(stream instanceof PDFRawStream)) continue;
    if (stream.dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
    const width = num(stream.dict.get(PDFName.of("Width")));
    const height = num(stream.dict.get(PDFName.of("Height")));
    if (width >= MIN_SIDE || height >= MIN_SIDE) found.push({ stream, width, height });
  }
  return found;
}

export async function toWebImage(
  pdf: PDFDocument,
  dict: PDFDict,
  data: Uint8Array,
  width: number,
  height: number,
): Promise<{ mimeType: "image/jpeg" | "image/png"; bytes: Uint8Array } | null> {
  const filters = filtersOf(dict);
  if (filters.length === 1 && filters[0] === "/DCTDecode") return { mimeType: "image/jpeg", bytes: data };
  const deflated = filters.length === 1 && filters[0] === "/FlateDecode";
  if (!deflated && filters.length > 0) return null;
  if (num(dict.get(PDFName.of("BitsPerComponent"))) !== 8) return null;
  const channels = channelsOf(pdf, dict.get(PDFName.of("ColorSpace")));
  if (!channels) return null;

  const raw = deflated ? await inflate(data) : data;
  const rowBytes = width * channels;
  const parms = dict.lookupMaybe(PDFName.of("DecodeParms"), PDFDict);
  const predictor = num(parms?.get(PDFName.of("Predictor")));
  let scanlines: Uint8Array;
  if (predictor >= 10) {
    if (raw.length < (rowBytes + 1) * height) return null;
    scanlines = raw.subarray(0, (rowBytes + 1) * height);
  } else if (predictor <= 1) {
    if (raw.length < rowBytes * height) return null;
    scanlines = new Uint8Array((rowBytes + 1) * height);
    for (let y = 0; y < height; y++) scanlines.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  } else return null;
  return { mimeType: "image/png", bytes: await png(width, height, channels === 3 ? 2 : 0, scanlines) };
}

function num(v: unknown) { return v instanceof PDFNumber ? v.asNumber() : 0; }

function filtersOf(dict: PDFDict): string[] {
  const f = dict.get(PDFName.of("Filter"));
  if (f instanceof PDFArray) return f.asArray().map((x) => x.toString());
  return f ? [f.toString()] : [];
}

function channelsOf(pdf: PDFDocument, value: unknown): number {
  const space = value && !(value instanceof PDFName) ? pdf.context.lookup(value as PDFRef) : value;
  const name = space?.toString();
  if (name === "/DeviceRGB") return 3;
  if (name === "/DeviceGray") return 1;
  if (space instanceof PDFArray && space.get(0)?.toString() === "/ICCBased") {
    const profile = pdf.context.lookup(space.get(1) as PDFRef);
    const n = profile instanceof PDFRawStream ? num(profile.dict.get(PDFName.of("N"))) : 0;
    return n === 3 || n === 1 ? n : 0;
  }
  return 0;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as any]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
const inflate = (data: Uint8Array) => pipe(data, new DecompressionStream("deflate"));