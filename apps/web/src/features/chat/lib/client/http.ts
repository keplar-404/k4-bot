import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { type ChatErrorInfo, mapHttpError, networkError } from "../protocol";

export const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

export class ChatHttpError extends Error {
  readonly info: ChatErrorInfo;
  constructor(info: ChatErrorInfo) {
    super(info.message);
    this.name = "ChatHttpError";
    this.info = info;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ChatHttpError(networkError());
  }
  if (!res.ok) {
    // The session ended (expired or signed out elsewhere): sign in again, then come back here.
    if (res.status === 401) redirectToSignIn();
    const body = await res.json().catch(() => null);
    throw new ChatHttpError(
      mapHttpError(res.status, body, res.headers.get("retry-after")),
    );
  }
  return (await res.json()) as T;
}
