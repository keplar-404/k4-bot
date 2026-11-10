"use client";

import { HistoryIcon, Loader2Icon, WandSparklesIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStore } from "@/lib/store/local-store";
import { getRun, listRuns } from "../../api";
import { fetchTrigger, type JsonSchema } from "../settings/tools-api";
import { typeWords } from "../template/block-fields";
import { exampleObject, WEBHOOK_EXAMPLE } from "./sample-example";

const COPY = {
  webhook: {
    title: "Test run: a pretend webhook call",
    what: "Write the JSON body another service would POST to your webhook URL. Your workflow reads it as {{trigger.body…}}, so put in the fields your later blocks use.",
    last: "Use the last real request",
    trigger: "webhook",
    field: "body",
  },
  app: {
    title: "Test run: a pretend app event",
    what: "This is the data the app sends when the event happens (e.g. a new email). It starts filled with an example of that event: change the values to match what you want to test.",
    last: "Use the last real event",
    trigger: "app",
    field: "data",
  },
} as const;

const isEmpty = (s: string | null) =>
  !s || s.trim() === "" || s.trim() === "{}";

/**
 * A test run of a webhook or app-event workflow: the data it pretends to receive. For an app event it starts from an
 * example built from the app's own description of the event (Composio), and lists every field it sends; "Use the
 * last real…" fills in what the latest real call brought instead.
 */
export function SampleDialog({
  kind,
  workflowId,
  triggerSlug,
  sample,
  busy,
  onChange,
  onRun,
}: {
  kind: keyof typeof COPY;
  workflowId: string;
  /** The app event (Composio trigger slug) of an app-event workflow. */
  triggerSlug?: string;
  sample: string | null;
  busy: boolean;
  onChange: (sample: string | null) => void;
  onRun: () => void;
}) {
  const copy = COPY[kind];
  const open = sample !== null;
  const [{ loading, schema, event }, set] = useLocalStore(() => ({
    loading: false,
    schema: null as JsonSchema | null,
    event: "",
  }));

  // The event's description (what it sends), loaded when the dialog opens.
  useEffect(() => {
    if (!open || kind !== "app" || !triggerSlug) return;
    let live = true;
    fetchTrigger(triggerSlug).then(
      (t) => live && set({ schema: t.payload, event: t.name ?? "" }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [open, kind, triggerSlug, set]);

  const example =
    kind === "app" ? (schema ? exampleObject(schema) : null) : WEBHOOK_EXAMPLE;
  const fillExample = () =>
    example && onChange(JSON.stringify(example, null, 2));

  // An empty box starts with the example, so there is always something sensible to run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fill once, when the example arrives for an empty box
  useEffect(() => {
    if (open && example && isEmpty(sample)) fillExample();
  }, [open, schema]);

  let invalid = false;
  try {
    JSON.parse(sample || "{}");
  } catch {
    invalid = true;
  }

  async function fillFromLast() {
    set({ loading: true });
    try {
      const real = (await listRuns(workflowId)).items.find(
        (r) => r.trigger === copy.trigger,
      );
      if (!real)
        return void toast.info(
          `No real ${kind === "app" ? "event" : "request"} has arrived yet. Turn the workflow on and send one.`,
        );
      const input = (await getRun(real.id)).input as
        | Record<string, unknown>
        | undefined;
      onChange(JSON.stringify(input?.[copy.field] ?? {}, null, 2));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load it.");
    } finally {
      set({ loading: false });
    }
  }

  const fields = Object.entries(schema?.properties ?? {});
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.what} It runs your draft for real, so apps are really called.
          </DialogDescription>
        </DialogHeader>

        {kind === "app" && event && (
          <p className="text-sm">
            Event: <span className="font-medium">{event}</span>
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Textarea
            className="max-h-72 min-h-40 font-mono text-xs"
            value={sample ?? ""}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Test data (JSON)"
            aria-invalid={invalid}
            placeholder={JSON.stringify(WEBHOOK_EXAMPLE, null, 2)}
          />
          {invalid && (
            <p className="text-destructive text-xs">
              This is not valid JSON yet: check the quotes, commas and braces.
            </p>
          )}
        </div>

        {fields.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline">
              What this event sends ({fields.length} fields)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 flex max-h-48 flex-col gap-1.5 overflow-y-auto text-xs">
                {fields.map(([key, f]) => (
                  <li key={key} className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      <code className="font-medium">{key}</code>
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {typeWords(f)}
                      </Badge>
                    </span>
                    {f.description && (
                      <span className="text-muted-foreground">
                        {f.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!example} onClick={fillExample}>
              <WandSparklesIcon />
              Fill in an example
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void fillFromLast()}
            >
              {loading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <HistoryIcon />
              )}
              {copy.last}
            </Button>
          </div>
          <Button disabled={busy || invalid} onClick={onRun}>
            Run test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
