"use client";

import { toast } from "sonner";
import { create } from "zustand";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

/** Where a secret is used: a workflow, and the app, site or webhook check it is for there. */
export type SecretUse = {
  workflowId: string;
  workflowName: string;
  target: string;
  kind: "app" | "http" | "webhook";
};

export type Secret = {
  name: string;
  label: string;
  /** The app it is for (toolkit slug), with its name and logo from the catalog. */
  app?: string | null;
  appName?: string | null;
  appLogo?: string | null;
  hint: string | null;
  updatedAt?: string;
  usedBy?: SecretUse[];
};

async function failure(res: Response, fallback: string) {
  const b = (await res.json().catch(() => null)) as { message?: string } | null;
  return b?.message ?? fallback;
}

/**
 * The user's secret names (never the values), shared by the Secrets page, workflow secret pickers and the chat's
 * secret form: a secret saved or deleted anywhere shows everywhere.
 */
type SecretsState = {
  items: Secret[];
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  /** Saves (creates or replaces) a secret; true when it worked. */
  save: (
    name: string,
    value: string,
    label: string,
    app?: { slug: string; name: string; logo: string | null } | null,
  ) => Promise<boolean>;
  remove: (name: string) => Promise<void>;
};

export const useSecretsStore = create<SecretsState>()((set, get) => ({
  items: [],
  loaded: false,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${BASE}/api/v1/secrets`, {
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as {
        items?: Secret[];
      } | null;
      set({ items: body?.items ?? [], loaded: true });
    } catch {
      toast.error("Could not load secrets.");
    } finally {
      set({ loading: false });
    }
  },

  save: async (name, value, label, app = null) => {
    const res = await fetch(`${BASE}/api/v1/secrets/${name}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value, label, app: app?.slug ?? null }),
    });
    if (!res.ok) {
      toast.error(await failure(res, "Could not save."));
      return false;
    }
    const { hint } = (await res.json().catch(() => ({}))) as { hint?: string };
    // Shown at once; the reload confirms with the server.
    set((s) => ({
      items: [
        ...s.items.filter((i) => i.name !== name),
        {
          name,
          label,
          hint: hint ?? null,
          app: app?.slug ?? null,
          appName: app?.name ?? null,
          appLogo: app?.logo ?? null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    toast.success("Saved.");
    void get().load();
    return true;
  },

  remove: async (name) => {
    const res = await fetch(`${BASE}/api/v1/secrets/${name}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error(await failure(res, "Could not delete."));
      return;
    }
    set((s) => ({ items: s.items.filter((i) => i.name !== name) }));
    toast.success("Deleted.");
  },
}));
