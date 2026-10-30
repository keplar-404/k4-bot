"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { COLORS, SHAPES } from "@/lib/bloub/bot/skins";
import { COLOR_LABELS, SHAPE_LABELS } from "@/lib/bloub/labels";

export function AvatarCreateDialog({
  open: openProp,
  onOpenChange,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: boolean;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shape, setShape] = useState(SHAPES[0].id);
  const [color, setColor] = useState("encre");
  const [expression, setExpression] = useState("neutre");
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

  const handleCreate = useCallback(() => {
    setExpression("heureux");
    setTimeout(() => setExpression("neutre"), 1500);
    console.log("create", { name, description, shape, color });
    setOpen(false);
  }, [name, description, shape, color, setOpen]);

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
          <DialogTitle>Create Avatar</DialogTitle>
          <DialogDescription>
            Configure your bot's identity and appearance.
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
            <Button className="flex-1" onClick={handleCreate}>
              Create
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
