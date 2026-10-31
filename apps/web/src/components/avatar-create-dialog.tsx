"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BloubAvatar } from "@/components/bloub-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExpressionId } from "@/lib/bloub/bot/expressions";
import {
  COLORS,
  type ColorId,
  SHAPES,
  type ShapeId,
} from "@/lib/bloub/bot/skins";
import { COLOR_LABELS, SHAPE_LABELS } from "@/lib/bloub/labels";
import type { Bot, CreateBotInput } from "@/lib/bots";

export function AvatarCreateDialog({
  open: openProp,
  onOpenChange,
  trigger,
  bot,
  onSubmit,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: boolean;
  bot?: Bot;
  onSubmit: (input: CreateBotInput) => Promise<unknown>;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const isEditing = Boolean(bot);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shape, setShape] = useState<ShapeId>(SHAPES[0].id);
  const [color, setColor] = useState<ColorId>("encre");
  const [expression, setExpression] = useState<ExpressionId>("neutre");
  const [submitting, setSubmitting] = useState(false);

  // Reset fields each time the dialog opens (edit mode pre-fills from the bot).
  useEffect(() => {
    if (!open) return;
    setName(bot?.name ?? "");
    setDescription(bot?.description ?? "");
    setShape((bot?.shape as ShapeId) ?? SHAPES[0].id);
    setColor((bot?.color as ColorId) ?? "encre");
    setExpression("neutre");
  }, [open, bot]);
  const [lookAt, setLookAt] = useState<{ nx: number; ny: number } | null>({
    nx: 0,
    ny: 0.6,
  });
  const descRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function nameCaretLook() {
    const el = nameRef.current;
    if (!el) return { nx: 0, ny: 0.6 };
    const pos = el.selectionStart ?? 0;
    const col = pos;
    const nx = (col / 20) * 2 - 1;
    return {
      nx: Math.max(-1, Math.min(1, nx)),
      ny: 0.6,
    };
  }

  const caretLook = useCallback(() => {
    const el = descRef.current;
    if (!el) return { nx: 0, ny: 0.4 };
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const lines = before.split("\n");
    const lineIndex = lines.length - 1;
    const col = lines[lines.length - 1].length;
    const totalLines = Math.max(el.value.split("\n").length, 1);
    const ny = 0.5 + (lineIndex / Math.max(totalLines - 1, 1)) * 0.4;
    const nx = (col / 40) * 2 - 1;
    return {
      nx: Math.max(-1, Math.min(1, nx)),
      ny: Math.max(-1, Math.min(1, ny)),
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setExpression("heureux");
    try {
      await onSubmit({
        name: name || "Untitled bot",
        description,
        shape,
        color,
        expression: "neutre",
      });
      setOpen(false);
    } catch (e) {
      console.error("bot submit failed", e);
      toast.error(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
      setTimeout(() => setExpression("neutre"), 1500);
    }
  }, [name, description, shape, color, setOpen, onSubmit, submitting]);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PlusIcon />
          <span className="sr-only">Create avatar</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl gap-4 p-5">
        <DialogHeader className="items-center text-center">
          <DialogTitle>{isEditing ? "Edit Bot" : "Create Avatar"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your bot's identity and appearance."
              : "Configure your bot's identity and appearance."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6">
          <BloubAvatar
            size={120}
            shape={shape}
            color={color}
            expression={expression}
            animated
            lookAt={lookAt}
          />
          <div className="flex w-full flex-col gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={COLOR_LABELS[c.id] ?? c.id}
                  aria-pressed={color === c.id}
                  onClick={() => setColor(c.id)}
                  className={`flex size-6 items-center justify-center rounded-full border-2 transition ${
                    color === c.id ? "border-foreground" : "border-transparent"
                  }`}
                >
                  <span
                    className="block size-[78%] rounded-full ring-1 ring-black/10 ring-inset"
                    style={{ background: c.hex }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={SHAPE_LABELS[s.id] ?? s.id}
                  aria-pressed={shape === s.id}
                  onClick={() => setShape(s.id)}
                  className={`rounded-md border p-1 transition hover:bg-muted ${
                    shape === s.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <BloubAvatar
                    size={28}
                    shape={s.id}
                    color={color}
                    expression="neutre"
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="w-full space-y-2">
            <Label htmlFor="av-name">Name</Label>
            <Input
              ref={nameRef}
              id="av-name"
              placeholder="Bot name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setExpression("attentif");
                setLookAt(nameCaretLook());
              }}
              onFocus={() => {
                setExpression("attentif");
                setLookAt(nameCaretLook());
              }}
              onClick={() => setLookAt(nameCaretLook())}
              onKeyUp={() => setLookAt(nameCaretLook())}
              onBlur={() => {
                setLookAt({ nx: 0, ny: 0.6 });
                if (name.trim().length > 0) {
                  setExpression("heureux");
                  setTimeout(() => setExpression("neutre"), 1200);
                } else {
                  setExpression("neutre");
                }
              }}
            />
          </div>
          <div className="w-full space-y-2">
            <Label htmlFor="av-desc">Description</Label>
            <Textarea
              ref={descRef}
              id="av-desc"
              placeholder="Describe this bot"
              className="h-20 resize-none"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setExpression("attentif");
                setLookAt(caretLook());
              }}
              onFocus={() => {
                setExpression("attentif");
                setLookAt(caretLook());
              }}
              onClick={() => setLookAt(caretLook())}
              onKeyUp={() => setLookAt(caretLook())}
              onBlur={() => {
                setLookAt({ nx: 0, ny: 0.6 });
                if (description.trim().length > 0) {
                  setExpression("heureux");
                  setTimeout(() => setExpression("neutre"), 1200);
                } else {
                  setExpression("neutre");
                }
              }}
              rows={3}
            />
          </div>
          <div className="flex w-full gap-2">
            <Button
              className="flex-1"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save changes"
                  : "Create"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
