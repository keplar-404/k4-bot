/** One image from OpenRouter's image API: https://openrouter.ai/docs/guides/overview/multimodal/image-generation */
export async function requestImage(options: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: string;
  /** Data URLs of images to edit or take style/content from. */
  references: string[];
}): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      "http-referer": "https://k4.bot",
      "x-title": "K4 Bot",
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      n: 1,
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      ...(options.references.length ? { input_references: options.references } : {}),
    }),
    signal: AbortSignal.timeout(150_000),
  });
  const body = (await response.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string; media_type?: string }>;
    error?: { message?: string };
  } | null;
  const image = body?.data?.[0];
  if (!response.ok || !image?.b64_json) {
    throw new Error(`Image service error (${response.status}): ${body?.error?.message ?? "no image returned"}`.slice(0, 300));
  }
  return { base64: image.b64_json, mimeType: image.media_type?.startsWith("image/") ? image.media_type : "image/png" };
}
