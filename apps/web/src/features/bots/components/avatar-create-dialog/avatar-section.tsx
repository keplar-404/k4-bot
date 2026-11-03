"use client";

import type { BotColor, BotShape } from "@/features/avatar/bloub/bot/skins";
import { COLOR_LABELS, SHAPE_LABELS } from "@/features/avatar/bloub/labels";
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import type { BotForm } from "./use-bot-form";

export function AvatarSection({ form }: { form: BotForm }) {
  return (
    <>
      <BloubAvatar
        size={120}
        shape={form.shape}
        color={form.color}
        expression={form.expression}
        animated
        lookAt={form.lookAt}
      />
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          {form.COLORS.map((c: BotColor) => (
            <button
              key={c.id}
              type="button"
              aria-label={COLOR_LABELS[c.id] ?? c.id}
              aria-pressed={form.color === c.id}
              onClick={() => form.setColor(c.id)}
              className={`flex size-6 items-center justify-center rounded-full border-2 transition ${
                form.color === c.id ? "border-foreground" : "border-transparent"
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
          {form.SHAPES.map((s: BotShape) => (
            <button
              key={s.id}
              type="button"
              aria-label={SHAPE_LABELS[s.id] ?? s.id}
              aria-pressed={form.shape === s.id}
              onClick={() => form.setShape(s.id)}
              className={`rounded-md border p-1 transition hover:bg-muted ${
                form.shape === s.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <BloubAvatar
                size={28}
                shape={s.id}
                color={form.color}
                expression="neutre"
              />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
