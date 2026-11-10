"use client";

import { Loader2Icon, LockIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SecretApp } from "@/features/connect/api";
import { useSecretsStore } from "../store";
import { AppPicker } from "./app-picker";

/** Same rule as the server: UPPER_SNAKE_CASE, 2 to 41 characters, starting with a letter. */
export const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,40}$/;

/** Adds a secret (or replaces one with the same name). The value goes to the server once and never comes back. */
export function SecretForm() {
  const save = useSecretsStore((s) => s.save);
  // The form's own fields (local input state).
  const [name, setName] = useState("");
  const [app, setApp] = useState<SecretApp | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const badName = name !== "" && !SECRET_NAME.test(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!SECRET_NAME.test(name) || !value) return;
    setSaving(true);
    const ok = await save(name, value, app?.name ?? "", app);
    setSaving(false);
    if (ok) {
      setName("");
      setApp(null);
      setValue("");
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end md:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="secret-name">Name</Label>
        <Input
          id="secret-name"
          placeholder="STRIPE_API_KEY"
          className="font-mono"
          aria-invalid={badName}
          value={name}
          onChange={(e) =>
            setName(e.target.value.toUpperCase().replace(/\s/g, "_"))
          }
        />
        <p
          className={
            badName
              ? "text-destructive text-xs"
              : "text-muted-foreground text-xs"
          }
        >
          {badName
            ? "Letters, digits and _ only, starting with a letter."
            : "Used in blocks as {{secrets.NAME}}."}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="secret-app">App</Label>
        <AppPicker id="secret-app" value={app} onChange={setApp} />
        <p className="text-muted-foreground text-xs">
          Apps that sign in with an API key. Optional.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="secret-value">Value</Label>
        <Input
          id="secret-value"
          type="password"
          autoComplete="new-password"
          maxLength={4096}
          placeholder="sk_live_…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Encrypted. Never shown again, not even to your bots.
        </p>
      </div>
      <Button
        type="submit"
        disabled={!SECRET_NAME.test(name) || !value || saving}
        className="md:mb-5"
      >
        {saving ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
        Save
      </Button>
    </form>
  );
}
