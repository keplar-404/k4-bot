"use client";

import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchSecretApps, type SecretApp } from "@/features/connect/api";
import { AppLogo } from "@/features/connect/components/app-logo";
import { useLocalStore } from "@/lib/store/local-store";

const NONE = "__none__";

/** An app's logo and name, as in the Connect page (catalog logo on a white tile). */
function AppOption({ app }: { app: SecretApp }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AppLogo
        src={app.logo}
        name={app.name}
        size="sm"
        className="size-5 rounded-md p-0.5"
      />
      <span className="truncate">{app.name}</span>
    </span>
  );
}

/**
 * Which app a secret is for (shadcn Select): the most used apps that sign in with an API key, token or basic
 * login, from the app catalog. Optional: "No app" for any other service.
 */
export function AppPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: SecretApp | null;
  onChange: (app: SecretApp | null) => void;
}) {
  const [{ apps }, set] = useLocalStore(() => ({ apps: [] as SecretApp[] }));
  useEffect(() => {
    const ac = new AbortController();
    fetchSecretApps("", ac.signal, 100).then(
      (found) => set({ apps: found }),
      () => undefined,
    );
    return () => ac.abort();
  }, [set]);

  return (
    <Select
      value={value?.slug ?? NONE}
      onValueChange={(slug) =>
        onChange(
          slug === NONE ? null : (apps.find((a) => a.slug === slug) ?? null),
        )
      }
    >
      <SelectTrigger id={id} className="w-full" aria-label="App">
        <SelectValue>
          {value ? (
            <AppOption app={value} />
          ) : (
            <span className="text-muted-foreground">No app</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[min(28rem,calc(100svh-8rem))]">
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">No app (other service)</span>
        </SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Apps that use an API key</SelectLabel>
          {apps.map((app) => (
            <SelectItem key={app.slug} value={app.slug}>
              <AppOption app={app} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
