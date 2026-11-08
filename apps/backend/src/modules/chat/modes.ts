/** Permission modes for a chat thread. The server (chat_thread.mode) is the source of truth, never the request body. */
export const MODES = ["allow_all", "plan", "ask"] as const;
export type ChatMode = (typeof MODES)[number];
export const isMode = (v: unknown): v is ChatMode => (MODES as readonly unknown[]).includes(v);
