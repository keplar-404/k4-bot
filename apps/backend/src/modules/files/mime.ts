/**
 * One file is at most this big: uploads, created images, and files copied to or from the computer
 * (those cross a Durable Object call, whose messages are capped at 32 MiB).
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Shown in the browser (chat previews). Everything else, SVG included (it can carry script), is a download. */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/** A name that is safe in a header, a shell path and a marker line: no folders, control characters or quotes. */
export function safeName(name: string, fallback = "file"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(/[\u0000-\u001f\u007f"'`$\\]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return clean || fallback;
}

export function typeOf(name: string, given?: string | null): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (TYPES[ext]) return TYPES[ext];
  return given && /^[\w.+-]+\/[\w.+-]+$/.test(given) ? given : "application/octet-stream";
}

export const extensionFor = (mimeType: string) => EXTENSIONS[mimeType] ?? "png";

export const isInline = (mimeType: string) => INLINE_TYPES.has(mimeType);

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
