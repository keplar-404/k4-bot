import type { ComputerStub } from "../../../computer/sandbox-backend";
import type { Db } from "../../../../db";
import { formatBytes } from "../../../files";
import type { FileRef } from "../../parts";

/** Images the model looks at on its next calls (attached to the request only, never saved in the conversation). */
export interface ViewHolder {
  images: Array<{ name: string; dataUrl: string }>;
}

/** A model sees at most this many attached images at once, each at most this big. */
export const MAX_VIEW_IMAGES = 4;
export const MAX_VIEW_BYTES = 4 * 1024 * 1024;

export const toDataUrl = (mimeType: string, bytes: Uint8Array) => `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;

export interface FileToolsOptions {
  bucket: R2Bucket;
  db: Db;
  userId: string;
  botId: string;
  threadId: string;
  runId: string;
  openrouterApiKey: string;
  imageModel: string;
  maxImagesPerDay: number;
  maxStorageBytes: number;
  /** The model can look at images (offers view_image). */
  vision: boolean;
  view: ViewHolder;
  /** Present when the run may use the user's computer (offers copy_to_computer and share_file). */
  computer?: { stub: ComputerStub; home: string };
}

export const describeFile = (f: FileRef) => `"${f.name}" (${f.mimeType}, ${formatBytes(f.size)}, file id ${f.id})`;
