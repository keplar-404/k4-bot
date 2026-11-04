import { classifyProviderError } from "../../chat/run/provider-error";

/**
 * OpenRouter's PDF parser (the `file-parser` plugin) used as a document reader: the PDF is sent with a free model
 * and the parsed text comes back as a `file` annotation, which is all we keep. The model's own reply is one token.
 * - "cloudflare-ai": free. Reads the PDF's text layer (headings, tables, text) via Cloudflare Workers AI.
 * - "mistral-ocr": $2 per 1,000 pages. OCR for scans and text inside pictures.
 * https://openrouter.ai/docs/features/multimodal/pdfs
 */
export type PdfEngine = "cloudflare-ai" | "mistral-ocr";

/** The free router: the plugin's text reaches the model as input, so a paid model would bill it as tokens. */
const PARSE_MODEL = "openrouter/free";

/** The parsed pages of `pdf` (page 1 = its first page), or why parsing failed in words the bot can repeat. */
export async function parsePdf(
  apiKey: string,
  name: string,
  pdf: Uint8Array,
  engine: PdfEngine,
): Promise<{ ok: true; pages: string[] } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "x-title": "K4 Bot" },
      body: JSON.stringify({
        model: PARSE_MODEL,
        max_tokens: 1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Reply with one word: OK." },
              { type: "file", file: { filename: name, file_data: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}` } },
            ],
          },
        ],
        plugins: [{ id: "file-parser", pdf: { engine } }],
      }),
      signal: AbortSignal.timeout(120_000),
    }).catch((e: unknown) => e as Error);

    if (res instanceof Error) return { ok: false, error: `the PDF service could not be reached (${res.message})` };
    const body = (await res.json().catch(() => null)) as ParseResponse | null;
    const content = body?.choices?.[0]?.message?.annotations?.flatMap((a) => a.file?.content ?? []) ?? [];
    const text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    if (res.ok && text) return { ok: true, pages: splitPages(text) };

    const message = body?.error?.message ?? `HTTP ${res.status}`;
    const { reason } = classifyProviderError(Object.assign(new Error(message), { status: body?.error?.code ?? res.status }));
    // The free router's shared pool is often busy for a moment: one more try after a short wait.
    if (attempt === 0 && (reason === "rate_limited" || reason === "upstream_busy" || reason === "provider_error")) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    return { ok: false, error: explain(reason, message) };
  }
  return { ok: false, error: "the PDF service stayed busy" };
}

interface ParseResponse {
  choices?: Array<{ message?: { annotations?: Array<{ file?: { content?: Array<{ type: string; text?: string }> } }> } }>;
  error?: { message?: string; code?: number };
}

/**
 * The parser writes a metadata block, then "## Contents" with one "### Page N" heading per page. Pages are
 * returned in order; a document without page headings becomes a single page.
 */
export function splitPages(text: string): string[] {
  const body = text.includes("## Contents") ? text.slice(text.indexOf("## Contents") + "## Contents".length) : text;
  const cleaned = body.replace(/<\/?file[^>]*>/g, "");
  const parts = cleaned.split(/^###\s+Page\s+\d+\s*$/m);
  if (parts.length === 1) return [cleaned.trim()];
  return parts.slice(1).map((p) => p.trim());
}

function explain(reason: string, raw: string): string {
  switch (reason) {
    case "free_daily_limit":
      return "today's free OpenRouter requests are used up (the free PDF reader runs on them); it resets at 00:00 UTC";
    case "key_limit":
    case "no_credits":
      return "the OpenRouter key has no credit left for this (raise the key's limit in OpenRouter)";
    case "invalid_key":
      return "OpenRouter rejected the API key";
    case "rate_limited":
    case "upstream_busy":
      return "the PDF service is busy right now; try again in a minute";
    default:
      return `the PDF service failed (${raw.slice(0, 160)})`;
  }
}
