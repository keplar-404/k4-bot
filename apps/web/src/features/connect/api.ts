import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE } from "@/features/files/api/library";

/** One app of Composio's catalog (GET /api/v1/composio/catalog). */
export type CatalogApp = {
  slug: string;
  name: string;
  description: string;
  logo: string | null;
  categories: Array<{ slug: string; name: string }>;
  toolsCount: number;
  triggersCount: number;
  noAuth: boolean;
};

export type Category = { slug: string; name: string; count: number };

/** One of the user's connections (never the provider's credentials). */
export type Connection = {
  id: string;
  toolkit: string;
  status: string;
  account: string | null;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/composio${path}`, {
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
  if (res.status === 429)
    throw new Error("Too many requests. Wait a minute and try again.");
  if (!res.ok)
    throw new Error(body?.message ?? "Something went wrong. Try again.");
  return body as T;
}

export function fetchCatalog(
  query: {
    q?: string;
    category?: string;
    slugs?: string[];
    withTriggers?: boolean;
    noAuth?: boolean;
    offset: number;
    limit: number;
  },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    offset: String(query.offset),
    limit: String(query.limit),
  });
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.slugs) params.set("slugs", query.slugs.join(","));
  if (query.withTriggers) params.set("withTriggers", "1");
  if (query.noAuth) params.set("noAuth", "1");
  return request<{ items: CatalogApp[]; total: number }>(`/catalog?${params}`, {
    signal,
  });
}

export const fetchCategories = () =>
  request<{ items: Category[] }>("/categories").then((r) => r.items);

export const fetchConnections = () =>
  request<{ items: Connection[] }>("/connections").then((r) => r.items);

/**
 * The Connect Link for this app. The browser goes there and comes back to `returnTo` (a page of this app, e.g. the
 * workflow being edited) or to /dashboard/connect, with ?connected=<slug>.
 */
export const authorizeApp = (toolkit: string, returnTo?: string) =>
  request<{ redirectUrl: string }>("/authorize", {
    method: "POST",
    body: JSON.stringify({ toolkit, returnTo }),
  }).then((r) => r.redirectUrl);

export const disconnectApp = (id: string) =>
  request<{ ok: true }>(`/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

/** An app a secret can be for: it signs in with an API key, token or basic login (Composio's auth schemes). */
export type SecretApp = { slug: string; name: string; logo: string | null };

export const fetchSecretApps = (q: string, signal?: AbortSignal, limit = 40) =>
  request<{ items: SecretApp[] }>(
    `/secret-apps?${new URLSearchParams({ ...(q ? { q } : {}), limit: String(limit) })}`,
    { signal },
  ).then((r) => r.items);
