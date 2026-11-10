"use client";

import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { type Secret, useSecretsStore } from "../store";
import { SecretForm } from "./secret-form";
import { SecretRow } from "./secret-row";

/** The secrets vault: keys workflows use in app and HTTP blocks, each with what it is for and where it is used. */
export function SecretsPage() {
  const items = useSecretsStore((s) => s.items);
  const loaded = useSecretsStore((s) => s.loaded);
  const load = useSecretsStore((s) => s.load);
  const remove = useSecretsStore((s) => s.remove);
  const [deleting, setDeleting] = useState<Secret | null>(null);
  useEffect(() => void load(), [load]);

  return (
    <>
      <PageHeader title="Secrets" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">Secrets</h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            API keys and passwords your workflows need. Write{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              {"{{secrets.NAME}}"}
            </code>{" "}
            in an app action or HTTP request block; the value is filled in only
            when the block runs.
          </p>
        </div>

        <SecretForm />

        <section className="overflow-hidden rounded-xl border">
          <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-x-4 border-b bg-muted/40 px-4 py-2 font-medium text-muted-foreground text-xs md:grid">
            <span>Name</span>
            <span>For</span>
            <span>Used in</span>
            <span className="w-7" />
          </div>
          {!loaded ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground text-sm">
              <KeyRoundIcon className="size-6" />
              No secrets yet. Add one above, or let a bot ask you for it in the
              chat.
            </div>
          ) : (
            <div className="divide-y">
              {items.map((s) => (
                <SecretRow
                  key={s.name}
                  secret={s}
                  onDelete={() => setDeleting(s)}
                />
              ))}
            </div>
          )}
        </section>

        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <ShieldCheckIcon className="size-3.5" />
          Encrypted with AES-256. Values are never sent to a bot or a model, and
          run logs show [secret:NAME] instead.
        </p>
      </div>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.usedBy?.length
                ? `Used by ${deleting.usedBy.map((u) => u.workflowName).join(", ")}. Those blocks fail until you add it again. Workflows that are on block the delete.`
                : "No workflow uses it. The value cannot be recovered."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) void remove(deleting.name);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
