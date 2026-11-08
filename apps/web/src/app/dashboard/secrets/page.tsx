"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

type Secret = { name: string; label: string; hint: string | null };
/** Same rule as the server: UPPER_SNAKE_CASE, 2 to 41 characters, starting with a letter. */
const NAME = /^[A-Z][A-Z0-9_]{1,40}$/;

export default function SecretsPage() {
  const [items, setItems] = useState<Secret[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/v1/secrets`, {
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as {
        items?: Secret[];
      } | null;
      setItems(body?.items ?? []);
    } catch {
      toast.error("Could not load secrets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!NAME.test(name) || !value) return;
    const res = await fetch(`${BASE}/api/v1/secrets/${name}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value, label }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      toast.error(b?.message ?? "Could not save.");
      return;
    }
    toast.success("Saved.");
    setName("");
    setValue("");
    setLabel("");
    void load();
  };

  const remove = async (n: string) => {
    const res = await fetch(`${BASE}/api/v1/secrets/${n}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      toast.error(b?.message ?? "Could not delete.");
      return;
    }
    toast.success("Deleted.");
    void load();
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Secrets" />
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <Input
          placeholder="NAME (e.g. STRIPE_API_KEY)"
          aria-invalid={name !== "" && !NAME.test(name)}
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
        />
        <Input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="new-password"
          maxLength={4096}
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          onClick={() => void save()}
          disabled={!NAME.test(name) || !value}
        >
          Save securely
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs">
                  {s.hint ?? ""} {s.label ? `· ${s.label}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void remove(s.name)}
              >
                Delete
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-muted-foreground text-sm">No secrets saved.</p>
          )}
        </div>
      )}
    </div>
  );
}
