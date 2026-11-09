import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { loadFile } from "../files";
import { composioFor, rawClient } from "./client";

/** How a block's arguments point at a file from the user's Files page (the builder's file picker writes it). */
export type FileRef = { $file: string; name?: string };
const isFileRef = (v: unknown): v is FileRef =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as FileRef).$file === "string" &&
  Object.keys(v).every((k) => k === "$file" || k === "name");

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Replaces every {"$file": id} in an action's arguments with the file staged at Composio ({name, mimetype, s3key}),
 * which is what file inputs (an email attachment, a Slack upload) take. Composio's SDK cannot upload from Workers,
 * so this uses its API directly: ask for an upload URL, then PUT the bytes. Only the user's own files are used.
 */
export async function stageFiles(
  env: Env,
  db: Db,
  call: { userId: string; toolkit: string; tool: string },
  value: unknown,
): Promise<unknown> {
  if (isFileRef(value)) return stageOne(env, db, call, value.$file);
  if (Array.isArray(value)) return Promise.all(value.map((v) => stageFiles(env, db, call, v)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await stageFiles(env, db, call, v)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

async function stageOne(env: Env, db: Db, call: { userId: string; toolkit: string; tool: string }, fileId: string) {
  if (!env.FILES) throw new Error("File storage is not set up on this server.");
  const file = await loadFile(env.FILES, db, call.userId, fileId);
  if (!file) throw new FileGoneError("A file this step sends was deleted. Pick another one.");

  const bytes = new Uint8Array(file.bytes); // an ArrayBuffer-backed copy: what digest() and fetch() accept
  const md5 = hex(await crypto.subtle.digest("MD5", bytes));
  const upload = await rawClient(composioFor(env)).files.createPresignedURL({
    toolkit_slug: call.toolkit,
    tool_slug: call.tool,
    filename: file.row.name,
    mimetype: file.row.mimeType,
    md5,
  });
  const put = await fetch(upload.new_presigned_url, {
    method: "PUT",
    headers: { "content-type": file.row.mimeType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Could not upload ${file.row.name} to the app (${put.status}).`);
  return { name: file.row.name, mimetype: file.row.mimeType, s3key: upload.key };
}

/** The file is gone: a retry cannot help. */
export class FileGoneError extends Error {}
