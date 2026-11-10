"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BASE } from "@/features/files/api/library";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { Field } from "../field";

type Secret = { name: string; label: string; hint: string | null };

/** Pick a secret from the vault by name: the value itself never reaches the browser. */
export function SecretPicker({
  value,
  onChange,
  hint = "The value the sender shares with you. Saved encrypted on the Secrets page.",
}: {
  value?: string;
  onChange: (name: string) => void;
  hint?: string;
}) {
  const [{ secrets }, , store] = useLocalStore(() => ({
    secrets: null as Secret[] | null,
  }));
  const setSecrets = fieldSetter(store, "secrets");
  useEffect(() => {
    fetch(`${BASE}/api/v1/secrets`, { credentials: "include" })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ items?: Secret[] }>) : { items: [] },
      )
      .then(
        (b: { items?: Secret[] }) => setSecrets(b.items ?? []),
        () => setSecrets([]),
      );
  }, [setSecrets]);
  return (
    <Field id="hook-secret" label="Secret" required hint={hint}>
      {secrets && secrets.length === 0 ? (
        <p className="text-sm">
          No secrets yet.{" "}
          <Link
            href="/dashboard/secrets"
            className="underline underline-offset-2"
          >
            Add one on the Secrets page
          </Link>
          .
        </p>
      ) : (
        <Select value={value ?? ""} onValueChange={(v) => v && onChange(v)}>
          <SelectTrigger id="hook-secret" className="w-full">
            <SelectValue placeholder="Choose a secret">{value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(secrets ?? []).map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
                {s.label ? ` · ${s.label}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
