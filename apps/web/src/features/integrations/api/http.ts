import { redirectToSignIn } from "@/features/auth/auth-redirect";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/integrations${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Connection lost. Try again.");
  }
  if (res.status === 401) redirectToSignIn();
  const body = (await res.json().catch(() => null)) as
    | (T & { message?: string })
    | null;
  if (!res.ok)
    throw new Error(body?.message ?? "Something went wrong. Try again.");
  return body as T;
}
