"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  PlugIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel } from "@/lib/bot-roles";
import {
  type CatalogMcp,
  connectMcp,
  disconnectMcp,
  type InstalledMcp,
  replaceMcpSecrets,
  useIntegrations,
} from "@/lib/integrations";

/**
 * The token form. The value is sent once, checked against the app by the server, then stored encrypted; it is
 * never shown again (only its last characters). `replace` updates the token of an existing connection.
 */
function ConnectForm({
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
      {server.fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`mcp-${server.id}-${f.key}`}>{f.label}</Label>
          <Input
            id={`mcp-${server.id}-${f.key}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={f.placeholder}
            value={values[f.key] ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, [f.key]: e.target.value }))
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            {f.help}{" "}
            {f.helpUrl && (
              <a
                href={f.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                Create one
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </p>
        </div>
      ))}
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

function ServerDetails({
  server,
  installed,
  onBack,
}: {
  server: CatalogMcp;
  installed?: InstalledMcp;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const connectNoKey = async () => {
    setBusy(true);
    try {
      await connectMcp(server.id);
      toast.success(`${server.name} connected`, {
        description: "Add it to a bot when you create or edit the bot.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeftIcon />
          All MCP servers
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold">{server.name}</h3>
          <p className="text-sm text-muted-foreground">
            {server.publisher} ·{" "}
            <a
              href={server.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              Docs
              <ExternalLinkIcon className="size-3" />
            </a>
          </p>
        </div>
        {installed ? (
          <Badge variant="secondary">
            <CheckIcon />
            Connected
          </Badge>
        ) : (
          server.fields.length === 0 && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void connectNoKey()}
            >
              {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Connect
            </Button>
          )
        )}
      </header>
      <p className="text-sm">{server.description}</p>
      <section className="space-y-2">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          What your bots can do
        </h4>
        <ul className="space-y-1 text-sm">
          {server.capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {c}
            </li>
          ))}
        </ul>
        {server.roles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Suits {server.roles.map((r) => roleLabel(r)).join(", ")} bots.
          </p>
        )}
      </section>
      {server.fields.length > 0 && (
        <section className="space-y-3 rounded-lg border p-4">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <KeyRoundIcon className="size-4" />
            {installed ? "Token" : "Connect your account"}
          </h4>
          {installed && !replacing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Saved, encrypted, ending in{" "}
                <span className="font-mono">{installed.secretHint}</span>
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReplacing(true)}
              >
                Replace token
              </Button>
            </div>
          ) : (
            <ConnectForm
              server={server}
              replace={installed}
              onDone={() => setReplacing(false)}
            />
          )}
        </section>
      )}
    </div>
  );
}

/** Connected apps (MCP servers). A card opens its details; + connects it (asking for a token when it needs one). */
export function McpTab() {
  const { mcp, error } = useIntegrations();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (error && !mcp) return <p className="text-sm text-destructive">{error}</p>;
  if (!mcp)
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );

  const server = mcp.catalog.find((s) => s.id === selected);
  if (server)
    return (
      <ServerDetails
        server={server}
        installed={mcp.installed.find((i) => i.serverId === server.id)}
        onBack={() => setSelected(null)}
      />
    );

  const add = async (s: CatalogMcp) => {
    // Apps that need a token open their page, where the form is.
    if (s.fields.length > 0) return setSelected(s.id);
    setBusy(s.id);
    try {
      await connectMcp(s.id);
      toast.success(`${s.name} connected`, {
        description: "Add it to a bot when you create or edit the bot.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (i: InstalledMcp) => {
    setBusy(i.id);
    try {
      await disconnectMcp(i.id);
      toast.success(`${i.name} disconnected`, {
        description: "Its saved token was deleted.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Connected</h3>
        {mcp.installed.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No apps connected yet. Connect one below, then add it to a bot from
            the bot&apos;s settings.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {mcp.installed.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelected(i.serverId)}
                >
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.needsSecrets
                      ? `Token ending in ${i.secretHint ?? "…"}`
                      : "No key needed"}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Disconnect ${i.name}`}
                  title="Disconnect (deletes the saved token, removes it from your bots)"
                  disabled={busy === i.id}
                  onClick={() => void remove(i)}
                >
                  {busy === i.id ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <Trash2Icon />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Available MCP servers</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {mcp.catalog.map((s) => {
            const connected = Boolean(s.connectedId);
            return (
              <li key={s.id}>
                {/* biome-ignore lint/a11y/useSemanticElements: the card holds its own connect button, so it cannot be a <button> */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(s.id);
                    }
                  }}
                  className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {s.summary}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                      {s.fields.length > 0 ? (
                        <>
                          <KeyRoundIcon className="size-3" />
                          Needs a token
                        </>
                      ) : (
                        "Free, no key"
                      )}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant={connected ? "ghost" : "outline"}
                    disabled={connected || busy === s.id}
                    aria-label={
                      connected ? `${s.name} is connected` : `Connect ${s.name}`
                    }
                    title={connected ? "Connected" : "Connect"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void add(s);
                    }}
                  >
                    {busy === s.id ? (
                      <Loader2Icon className="animate-spin" />
                    ) : connected ? (
                      <CheckIcon />
                    ) : (
                      <PlusIcon />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
