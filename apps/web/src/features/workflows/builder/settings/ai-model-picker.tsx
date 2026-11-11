"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listModels, type ModelRow } from "@/features/chat/lib/client/models";
import { Field } from "./field";

/**
 * The model a "normal bot" step uses (the chat's model catalog). With no model chosen yet it takes the catalog's
 * default, so a new block is ready to run.
 */
export function AiModelPicker({
  modelId,
  reasoningEffort,
  onChange,
}: {
  modelId: string | undefined;
  reasoningEffort: string | undefined;
  onChange: (patch: { modelId?: string; reasoningEffort?: string }) => void;
}) {
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only on mount; picking a model is the user's
  useEffect(() => {
    listModels().then(
      (c) => {
        setModels(c.models);
        if (!modelId) onChange({ modelId: c.defaultModel });
      },
      (e: Error) => setError(e.message),
    );
  }, []);

  const model = models?.find((m) => m.id === modelId);
  return (
    <>
      <Field
        id="ai-model"
        label="Model"
        required
        hint={
          error ??
          "Which AI model answers. Bigger models follow long tasks better; free ones can be slow or busy."
        }
      >
        <Select
          value={modelId ?? ""}
          onValueChange={(v) =>
            onChange({ modelId: v || undefined, reasoningEffort: undefined })
          }
        >
          <SelectTrigger id="ai-model" className="w-full">
            <SelectValue placeholder="e.g. Claude Sonnet">
              {model?.name ?? modelId}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(models ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
                <span className="ml-auto text-muted-foreground text-xs">
                  {m.tag}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {model && model.reasoningEfforts.length > 0 && (
        <Field
          id="ai-effort"
          label="Thinking"
          hint="More thinking is slower and uses more tokens, but helps with tricky decisions."
        >
          <Select
            value={reasoningEffort ?? ""}
            onValueChange={(v) => onChange({ reasoningEffort: v || undefined })}
          >
            <SelectTrigger id="ai-effort" className="w-full">
              <SelectValue placeholder="Model default">
                {reasoningEffort}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Model default</SelectItem>
              {model.reasoningEfforts.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  );
}
