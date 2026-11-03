import { request } from "./http";

export interface ModelRow {
  id: string;
  name: string;
  free: boolean;
  vision: boolean;
  reasoning: boolean;
  reasoningEfforts: string[];
  /** Context window in tokens (live from OpenRouter). */
  contextLength: number;
  tag: string;
}

type ModelCatalog = { models: ModelRow[]; defaultModel: string };
let catalog: Promise<ModelCatalog> | null = null;

/**
 * The model catalog, fetched once per page load and shared by every chat (it only changes with a
 * deploy; the server also lets the browser cache it). A failed fetch is not kept, so the next call retries.
 */
export function listModels(): Promise<ModelCatalog> {
  catalog ??= request<ModelCatalog>("/api/v1/models").catch((error) => {
    catalog = null;
    throw error;
  });
  return catalog;
}
