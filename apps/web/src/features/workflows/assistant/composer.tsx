"use client";

import {
  Loader2Icon,
  PaperclipIcon,
  SendIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listModels, type ModelRow } from "@/features/chat/lib/client/models";
import { uploadFile } from "@/features/files/api/upload";
import { useBuilder } from "../builder/store";
import { isWorking, sendMessage, stopRun } from "./api";
import { useAssistant } from "./store";

const MODEL_KEY = "workflow-assistant-model";
const MAX_FILES = 5;
type Upload = { key: string; name: string; mimeType: string; id?: string };

/** A save still running could land after the assistant starts and be refused: wait for it (up to 5 s). */
async function savedDraft() {
  for (let i = 0; i < 50; i++) {
    if (useBuilder.getState().saved) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** The message box: text, attachments (images and text files), the model, Send / Stop. */
export function Composer({
  workflowId,
  prompt,
}: {
  workflowId: string;
  prompt?: string;
}) {
  const thread = useAssistant((s) => s.thread);
  const run = useAssistant((s) => s.run);
  const working = isWorking(run?.status);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Upload[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt) setText(prompt);
  }, [prompt]);

  useEffect(() => {
    listModels().then(
      (c) => {
        setModels(c.models);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(MODEL_KEY);
        } catch {
          // Private window: the default model.
        }
        const known = (id: string | null | undefined) =>
          id && c.models.some((m) => m.id === id) ? id : undefined;
        setModelId(known(thread?.modelId) ?? known(saved) ?? c.defaultModel);
      },
      () => undefined,
    );
  }, [thread?.modelId]);

  const pickModel = (id: string) => {
    setModelId(id);
    try {
      localStorage.setItem(MODEL_KEY, id);
    } catch {
      // Not remembered this time.
    }
  };

  const attach = (picked: File[]) => {
    const room = MAX_FILES - files.length;
    if (picked.length > room)
      toast.warning(`Up to ${MAX_FILES} files per message.`);
    for (const file of picked.slice(0, Math.max(0, room))) {
      const key = crypto.randomUUID();
      setFiles((f) => [...f, { key, name: file.name, mimeType: file.type }]);
      uploadFile(file, "").then(
        (stored) =>
          setFiles((f) =>
            f.map((x) =>
              x.key === key
                ? { ...x, id: stored.id, mimeType: stored.mimeType }
                : x,
            ),
          ),
        (e: Error) => {
          toast.error(e.message);
          setFiles((f) => f.filter((x) => x.key !== key));
        },
      );
    }
  };

  const uploading = files.some((f) => !f.id);
  const send = async () => {
    const content = text.trim();
    if (!content || !thread || working || uploading) return;
    setSending(true);
    try {
      if (!(await savedDraft()))
        throw new Error(
          "Your last change is still saving. Try again in a moment.",
        );
      const stored = files.flatMap((f) =>
        f.id ? [{ id: f.id, name: f.name, mimeType: f.mimeType }] : [],
      );
      await sendMessage(thread.id, {
        content,
        workflowId,
        modelId,
        fileIds: stored.map((f) => f.id),
        files: stored,
      });
      setText("");
      setFiles([]);
      await useAssistant.getState().refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t p-2">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {files.map((f) => (
            <li
              key={f.key}
              className="flex max-w-40 items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-0.5 pl-2 text-xs"
            >
              {!f.id && <Loader2Icon className="size-3 animate-spin" />}
              <span className="truncate">{f.name}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${f.name}`}
                onClick={() =>
                  setFiles((all) => all.filter((x) => x.key !== f.key))
                }
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder="e.g. Every morning at 8, email me a summary of new Stripe payments"
        aria-label="Message the assistant"
        maxLength={8000}
        className="max-h-40 min-h-16 resize-none text-sm"
      />
      <div className="flex items-center gap-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Attach images or files"
          title="Attach images or files"
          onClick={() => input.current?.click()}
        >
          <PaperclipIcon />
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,.json"
          className="hidden"
          onChange={(e) => {
            attach([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Select value={modelId ?? ""} onValueChange={(v) => v && pickModel(v)}>
          <SelectTrigger
            size="sm"
            aria-label="Model"
            className="h-8 min-w-0 flex-1 text-xs"
          >
            <SelectValue placeholder="Model">
              {models.find((m) => m.id === modelId)?.name ?? modelId}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {working && run ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              stopRun(run.id).then(
                () => useAssistant.getState().refresh(),
                (e: Error) => toast.error(e.message),
              )
            }
          >
            <SquareIcon />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!text.trim() || sending || uploading || !thread}
            onClick={() => void send()}
          >
            {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
