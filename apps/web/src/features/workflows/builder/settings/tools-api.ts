import { BASE } from "@/features/files/api/library";

export type ToolSummary = {
  slug: string;
  name: string;
  description: string;
  version: string | null;
};
export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  default?: unknown;
  examples?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
};
export type ToolDetail = ToolSummary & {
  input: JsonSchema;
  output: JsonSchema;
};

const memo = new Map<string, Promise<unknown>>();

/** GETs from the Composio routes, cached for the page's life (the server caches too). A failure is not cached. */
function get<T>(path: string): Promise<T> {
  const hit = memo.get(path);
  if (hit) return hit as Promise<T>;
  const p = fetch(`${BASE}/api/v1/composio${path}`, {
    credentials: "include",
  }).then(async (res) => {
    const body = (await res.json().catch(() => null)) as
      | (T & { message?: string })
      | null;
    if (!res.ok || !body)
      throw new Error(body?.message ?? "Could not load this app's actions.");
    return body as T;
  });
  memo.set(path, p);
  p.catch(() => memo.delete(path));
  return p;
}

export const fetchTools = (toolkit: string) =>
  get<{ items: ToolSummary[] }>(
    `/toolkits/${encodeURIComponent(toolkit)}/tools`,
  ).then((r) => r.items);
export const fetchTool = (slug: string) =>
  get<ToolDetail>(`/tools/${encodeURIComponent(slug)}`);
