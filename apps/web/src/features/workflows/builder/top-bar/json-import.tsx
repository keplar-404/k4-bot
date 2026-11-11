"use client";

import {
  MAX_PORTABLE_CHARS,
  PORTABLE_FORMAT,
  PORTABLE_VERSION,
  type PortableWorkflow,
  reviewOf,
} from "@backend/modules/workflows/graph/portable";
import { useReactFlow } from "@xyflow/react";
import {
  ClipboardPasteIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { type ChangeEvent, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { importWorkflow, type WorkflowApiError } from "../../api";
import { appName } from "../block-label";
import { useBuilder } from "../store";

type Review = ReturnType<typeof reviewOf>;

/** Reads pasted or uploaded text as a k4-workflow file. The server checks it fully; this only catches the obvious. */
function readFile(
  text: string,
): { doc: PortableWorkflow; review: Review } | { error: string } {
  if (text.length > MAX_PORTABLE_CHARS)
    return { error: "The file is too large (512 KB at most)." };
  let doc: PortableWorkflow;
  try {
    doc = JSON.parse(text);
  } catch {
    return { error: "This is not valid JSON." };
  }
  if (doc?.format !== PORTABLE_FORMAT || !Array.isArray(doc.graph?.nodes))
    return { error: "This is not a workflow file." };
  if (doc.version !== PORTABLE_VERSION)
    return { error: "This workflow file is from an unsupported version." };
  try {
    return { doc, review: reviewOf(doc.graph) };
  } catch {
    return { error: "The workflow file is not valid." };
  }
}

/** A save still running could land after the import and bring the old canvas back: wait for it (up to 5 s). */
async function savedDraft() {
  for (let i = 0; i < 50; i++) {
    if (useBuilder.getState().saved) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/**
 * Paste or upload a k4-workflow file, see what it brings, then replace this workflow's draft with it. A workflow that is
 * on keeps running its published copy until it is published again.
 */
export function JsonImport({ onDone }: { onDone: () => void }) {
  const [{ text, error, busy }, , store] = useLocalStore(() => ({
    text: "",
    error: null as string | null,
    busy: false,
  }));
  const setText = fieldSetter(store, "text");
  const setError = fieldSetter(store, "error");
  const setBusy = fieldSetter(store, "busy");
  const fileInput = useRef<HTMLInputElement>(null);
  const { fitView } = useReactFlow();
  const read = text.trim() ? readFile(text) : null;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PORTABLE_CHARS)
      return setError("The file is too large (512 KB at most).");
    setError(null);
    setText(await file.text());
  };

  const replace = async (doc: PortableWorkflow) => {
    setBusy(true);
    setError(null);
    try {
      if (!(await savedDraft())) {
        setError("Your last change is still saving. Try again in a moment.");
        return;
      }
      const w = useBuilder.getState().workflow;
      if (!w) return;
      const next = await importWorkflow(w.id, {
        document: doc,
        expectedUpdatedAt: w.updatedAt,
      });
      useBuilder.getState().load(next);
      setTimeout(() => void fitView({ padding: 0.4, maxZoom: 1 }), 50);
      toast.success("Workflow imported", {
        description: "Connect its apps and pick its bots, then turn it on.",
      });
      setText("");
      onDone();
    } catch (e) {
      setError((e as WorkflowApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Paste a workflow's JSON or upload its file. It replaces this workflow;
        accounts, bots and secrets are never imported.
      </p>
      <Textarea
        value={text}
        onChange={(e) => {
          setError(null);
          setText(e.target.value);
        }}
        placeholder='{ "format": "k4-workflow", … }'
        aria-label="Workflow JSON"
        spellCheck={false}
        className="min-h-40 flex-1 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            navigator.clipboard
              .readText()
              .then(setText)
              .catch(() => setError("Paste into the box with Ctrl+V instead."))
          }
        >
          <ClipboardPasteIcon />
          Paste
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => fileInput.current?.click()}
        >
          <UploadIcon />
          Upload file
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void onFile(e)}
        />
      </div>

      {(error ?? (read && "error" in read ? read.error : null)) && (
        <p className="text-destructive text-sm">
          {error ?? (read && "error" in read ? read.error : "")}
        </p>
      )}

      {read && "doc" in read && (
        <ImportReview
          name={read.doc.name}
          review={read.review}
          busy={busy}
          onConfirm={() => void replace(read.doc)}
        />
      )}
    </div>
  );
}

function ImportReview({
  name,
  review,
  busy,
  onConfirm,
}: {
  name: string;
  review: Review;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <p className="font-medium">
        {name} · {review.blocks} {review.blocks === 1 ? "block" : "blocks"}
      </p>
      <ul className="flex flex-col gap-1 text-muted-foreground text-xs">
        {review.apps.length > 0 && (
          <li>Apps to connect: {review.apps.map(appName).join(", ")}</li>
        )}
        {review.bots > 0 && (
          <li>
            {review.bots} “Ask a bot” {review.bots === 1 ? "step" : "steps"} to
            give one of your bots
          </li>
        )}
        <li>Secrets are removed: pick your own where a step needs one.</li>
      </ul>
      {(review.hosts.length > 0 || review.code > 0) && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-amber-700 text-xs dark:text-amber-300">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
          <span>
            Only import workflows you trust.
            {review.hosts.length > 0 &&
              ` It sends requests to: ${review.hosts.join(", ")}.`}
            {review.code > 0 &&
              ` It runs ${review.code} Code ${review.code === 1 ? "block" : "blocks"}.`}
          </span>
        </div>
      )}
      <Button variant="destructive" disabled={busy} onClick={onConfirm}>
        {busy && <Loader2Icon className="animate-spin" />}
        Replace this workflow
      </Button>
    </section>
  );
}
