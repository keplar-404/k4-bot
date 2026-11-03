import { ChatHttpError } from "@/features/chat/lib/client";
import { type ChatErrorInfo, networkError } from "@/features/chat/lib/protocol";

export const FATAL = new Set(["auth", "forbidden", "not_found"]);

export const toInfo = (err: unknown): ChatErrorInfo =>
  err instanceof ChatHttpError ? err.info : networkError();
