import mammoth from "mammoth";

/**
 * A .docx as text with its paragraphs (mammoth 1.13 has no markdown output, so headings are plain lines).
 * Both inputs are given: mammoth's Node build reads `buffer`, its browser build (which a Worker bundle may pick)
 * reads `arrayBuffer`. The bytes are copied first, since a Uint8Array may be a view into a larger buffer.
 */
export async function docxToMarkdown(bytes: Uint8Array): Promise<string> {
  const copy = bytes.slice();
  const result = await mammoth.extractRawText({ arrayBuffer: copy.buffer as ArrayBuffer, buffer: Buffer.from(copy) } as { arrayBuffer: ArrayBuffer });
  return result.value.replace(/\n{3,}/g, "\n\n").trim();
}
