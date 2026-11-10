"use client";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import {
  getMemory,
  type MemoryTarget,
  type MemoryText,
  saveMemory,
} from "./api";

const COPY = {
  preferences: {
    title: "Your preferences",
    description:
      "Shared by all of your bots: how to address you, language, tone, formats. Bots update this when you tell them a lasting preference.",
    empty: "Nothing saved yet. Tell any bot a preference, or add one here.",
  },
  bot: {
    title: "Memory",
    description:
      "What this bot remembers across its chats. Only this bot can see it; your other bots cannot.",
    empty: "This bot has not saved anything yet.",
  },
} as const;

/**
 * Shows a memory text read-only; it becomes editable only after the user clicks Edit (so a stray keystroke never
 * changes what the bots remember). Loads fresh each time it opens, since bots may have changed it meanwhile.
 */
export function MemoryDialog({
  target,
  title,
  open,
  onOpenChange,
}: {
  target: MemoryTarget;
  /** Overrides the title, e.g. "kimi's memory". */
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const copy = COPY[target.kind];
  const [{ data, draft, editing, saving, error }, , store] = useLocalStore(
    () => ({
      data: null as MemoryText | null,
      draft: "",
      editing: false,
      saving: false,
      error: null as string | null,
    }),
  );
  const setData = fieldSetter(store, "data");
  const setDraft = fieldSetter(store, "draft");
  const setEditing = fieldSetter(store, "editing");
  const setSaving = fieldSetter(store, "saving");
  const setError = fieldSetter(store, "error");
  const key = target.kind === "bot" ? target.botId : "preferences";

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifies the target; reload when it opens
  useEffect(() => {
    if (!open) return;
    setData(null);
    setEditing(false);
    setError(null);
    getMemory(target)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [open, key]);

  const save = async () => {
    setSaving(true);
    try {
      setData(await saveMemory(target, draft));
      setEditing(false);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !data ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2Icon className="animate-spin" aria-label="Loading" />
          </div>
        ) : editing ? (
          <div className="flex flex-col gap-1">
            <Textarea
              value={draft}
              maxLength={data.max}
              rows={12}
              autoFocus
              aria-label={title ?? copy.title}
              onChange={(e) => setDraft(e.target.value)}
              className="max-h-[50vh] font-mono text-xs"
            />
            <p className="self-end text-[11px] text-muted-foreground tabular-nums">
              {draft.length} / {data.max}
            </p>
          </div>
        ) : (
          <div className="max-h-[50vh] min-h-24 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {data.content || (
              <span className="text-muted-foreground">{copy.empty}</span>
            )}
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving && <Loader2Icon className="animate-spin" />}
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              disabled={!data}
              onClick={() => {
                setDraft(data?.content ?? "");
                setEditing(true);
              }}
            >
              <PencilIcon />
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
