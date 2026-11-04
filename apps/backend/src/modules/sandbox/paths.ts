/** The editor works inside the sandbox user's home; nothing outside it is listed, read or saved from the page. */
export const HOME = "/home/user";

/** A path from the page → an absolute path under HOME, or null when it would leave it. */
export function homePath(input: string): string | null {
  const raw = input.trim().replace(/\\/g, "/");
  const parts: string[] = [];
  for (const part of (raw.startsWith("/") ? raw : `${HOME}/${raw}`).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const abs = `/${parts.join("/")}`;
  return abs === HOME || abs.startsWith(`${HOME}/`) ? abs : null;
}

/** Folders the file tree skips (huge and generated). */
export const SKIP_DIRS = ["node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv", ".cache", ".npm"];

/** SHA-256 hex of a text: the editor's "version" of a file, so a save over newer agent changes is caught. */
export async function hashOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `find` output (one path per line, files suffixed by type) → tree entries relative to HOME. */
export function parseTree(out: string): Array<{ path: string; dir: boolean }> {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("d ") || l.startsWith("f "))
    .map((l) => ({ dir: l.startsWith("d "), path: l.slice(2).replace(`${HOME}/`, "") }))
    .filter((e) => e.path && e.path !== HOME)
    .sort((a, b) => a.path.localeCompare(b.path));
}
