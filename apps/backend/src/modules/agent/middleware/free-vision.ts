import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { createMiddleware } from "langchain";

/**
 * The free router (`openrouter/free`) picks a model per call and does not always pick one that can see: in testing
 * it sent a scanned page to a text-only model, which answered that no image was attached. So a call that carries
 * pictures (attached images, read_document's scanned pages, computer screenshots) goes to a free vision model
 * instead; every other call stays with the router. Innermost, after the middleware that adds the pictures.
 */
export function createFreeVisionMiddleware(vision: BaseChatModel) {
  return createMiddleware({
    name: "FreeVisionMiddleware",
    wrapModelCall: (request, handler) => (request.messages.some(hasImage) ? handler({ ...request, model: vision }) : handler(request)),
  });
}

const hasImage = (m: BaseMessage) =>
  Array.isArray(m.content) && m.content.some((part) => typeof part === "object" && (part.type === "image_url" || part.type === "image"));
