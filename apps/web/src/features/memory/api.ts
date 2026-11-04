import { redirectToSignIn } from "@/features/auth/auth-redirect";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

/** A memory text and its length limit. */
export interface MemoryText {
  content: string;
  max: number;
}

/** What the memory dialog edits: the user's global preferences, or one bot's own memory. */
export type MemoryTarget =
  | { kind: "preferences" }
  | { kind: "bot"; botId: string };

const pathOf = (t: MemoryTarget) =>
  t.kind === "preferences" ? "/preferences" : `/bots/${t.botId}`;

async function request(target: MemoryTarget, init?: RequestInit) {
  const res = await fetch(`${BASE}/api/v1/memory${pathOf(target)}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json" },
  });
  if (res.status === 401) redirectToSignIn();
  if (!res.ok) throw new Error("Could not load or save the memory.");
  return (await res.json()) as MemoryText;
}

export const getMemory = (target: MemoryTarget) => request(target);

export const saveMemory = (target: MemoryTarget, content: string) =>
  request(target, { method: "PUT", body: JSON.stringify({ content }) });
