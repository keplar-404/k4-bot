"use client";

import { GlobeIcon, KeyRoundIcon, Trash2Icon, WebhookIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/features/connect/components/app-logo";
import type { Secret, SecretUse } from "../store";

const logoOf = (slug: string) => `https://logos.composio.dev/api/${slug}`;
const titleCase = (slug: string) =>
  slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The app or site a secret is for: what the user wrote, else the first place a workflow uses it. */
function For({ secret }: { secret: Secret }) {
  // The app picked when it was saved (its catalog logo and name, as on the Connect page).
  if (secret.app) {
    const name = secret.appName ?? secret.label ?? titleCase(secret.app);
    return (
      <span className="flex items-center gap-2">
        <AppLogo
          src={secret.appLogo ?? logoOf(secret.app)}
          name={name}
          size="sm"
        />
        <span className="truncate">{name}</span>
      </span>
    );
  }
  const app = secret.usedBy?.find((u) => u.kind === "app");
  if (app) {
    return (
      <span className="flex items-center gap-2">
        <AppLogo src={logoOf(app.target)} name={app.target} size="sm" />
        <span className="truncate">
          {secret.label || titleCase(app.target)}
        </span>
      </span>
    );
  }
  const other = secret.usedBy?.[0];
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        {other?.kind === "webhook" ? (
          <WebhookIcon className="size-3.5" />
        ) : other ? (
          <GlobeIcon className="size-3.5" />
        ) : (
          <KeyRoundIcon className="size-3.5" />
        )}
      </span>
      <span
        className={
          secret.label || other ? "truncate" : "truncate text-muted-foreground"
        }
      >
        {secret.label || other?.target || "Not labelled"}
      </span>
    </span>
  );
}

/** One place it is used, linking to the workflow. */
function Use({ use }: { use: SecretUse }) {
  const where = use.kind === "app" ? titleCase(use.target) : use.target;
  return (
    <Link
      href={`/workflows/${use.workflowId}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-muted"
      title={`${use.workflowName} · ${where}`}
    >
      <span className="truncate font-medium">{use.workflowName}</span>
      <span className="shrink-0 text-muted-foreground">· {where}</span>
    </Link>
  );
}

/** One secret: name, what it is for, its last characters, where workflows use it, and delete. */
export function SecretRow({
  secret,
  onDelete,
}: {
  secret: Secret;
  onDelete: () => void;
}) {
  const uses = secret.usedBy ?? [];
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]">
      <div className="min-w-0">
        <p className="truncate font-medium font-mono text-sm">{secret.name}</p>
        <p className="font-mono text-muted-foreground text-xs">
          {secret.hint ?? "…"}
        </p>
      </div>
      <div className="col-span-2 row-start-2 min-w-0 text-sm md:col-span-1 md:row-start-auto">
        <For secret={secret} />
      </div>
      <div className="col-span-2 row-start-3 flex min-w-0 flex-wrap gap-1 md:col-span-1 md:row-start-auto">
        {uses.length === 0 ? (
          <span className="text-muted-foreground text-xs">
            Not used by any workflow
          </span>
        ) : (
          uses
            .slice(0, 3)
            .map((u) => <Use key={`${u.workflowId}:${u.target}`} use={u} />)
        )}
        {uses.length > 3 && (
          <span className="text-muted-foreground text-xs">
            +{uses.length - 3} more
          </span>
        )}
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        className="col-start-2 row-start-1 text-muted-foreground hover:text-destructive md:col-start-auto md:row-start-auto"
        onClick={onDelete}
        aria-label={`Delete ${secret.name}`}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
