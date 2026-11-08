import { KEEP_RESPONSE_HEADERS } from "../http-guard";

const MAX_BODY_BYTES = 1024 * 1024;

/** The HTTP block's output: status, a few headers, and the body (parsed when JSON was expected). */
export async function readResponse(res: Response, expect: "json" | "text") {
  const { text, truncated } = await readCapped(res);
  let body: unknown = text;
  if (expect === "json" && !truncated) {
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON after all: keep the text.
    }
  }
  const headers: Record<string, string> = {};
  for (const name of KEEP_RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers[name] = value;
  }
  return { status: res.status, headers, body, ...(truncated ? { truncated: true } : {}) };
}

/** Reads at most MAX_BODY_BYTES of the body. A bigger one is cut, and the result says so. */
async function readCapped(res: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", truncated: false };

  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  while (size < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) return { text: new TextDecoder().decode(bytes.subarray(0, size)), truncated: false };
    const room = MAX_BODY_BYTES - size;
    bytes.set(value.subarray(0, room), size);
    size += Math.min(value.length, room);
  }
  await reader.cancel().catch(() => undefined);
  return { text: new TextDecoder().decode(bytes), truncated: true };
}
