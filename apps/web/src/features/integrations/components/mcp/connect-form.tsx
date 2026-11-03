"use client";

import { Loader2Icon, LockIcon, PlugIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type CatalogMcp,
  connectMcp,
  type InstalledMcp,
  replaceMcpSecrets,
} from "@/features/integrations/api";
import { TokenFields } from "./token-fields";

/**
 * The token form. The value is sent once, checked against the app by the server, then stored encrypted; it is
 * never shown again (only its last characters). `replace` updates the token of an existing connection.
 */
export function ConnectForm({
  server,
  replace,
  onDone,
}: {
  server: CatalogMcp;
  replace?: InstalledMcp;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (replace) await replaceMcpSecrets(replace.id, values);
      else await connectMcp(server.id, values);
      setValues({});
      toast.success(
        replace ? `${server.name} token updated` : `${server.name} connected`,
        {
          description: replace
            ? undefined
            : "Add it to a bot when you create or edit the bot.",
        },
      );
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-4"
      autoComplete="off"
    >
      <TokenFields
        server={server}
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />
      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <LockIcon className="mt-0.5 size-3.5 shrink-0" />
        We check the token with {server.name}, then store it encrypted
        (AES-256-GCM). It is only decrypted on our server when your bot uses{" "}
        {server.name}, and it is never shown again.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2Icon className="animate-spin" /> : <PlugIcon />}
        {busy ? "Checking…" : replace ? "Save new token" : "Connect"}
      </Button>
    </form>
  );
}
