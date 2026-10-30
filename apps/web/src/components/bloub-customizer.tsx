"use client";

import { BloubAvatar } from "@/components/bloub-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BotExpression, EXPRESSIONS } from "@/lib/bloub/bot/expressions";
import {
  type BotColor,
  type BotShape,
  COLORS,
  SHAPES,
} from "@/lib/bloub/bot/skins";
import {
  COLOR_LABELS,
  EXPRESSION_LABELS,
  SHAPE_LABELS,
} from "@/lib/bloub/labels";

export type BloubCustomizerValue = {
  shape: string;
  color: string;
  expression: string;
};

export function BloubCustomizer({
  value,
  onChange,
}: {
  value: BloubCustomizerValue;
  onChange: (next: BloubCustomizerValue) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Shape</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPES.map((s: BotShape) => (
            <button
              key={s.id}
              type="button"
              aria-label={SHAPE_LABELS[s.id] ?? s.id}
              aria-pressed={value.shape === s.id}
              onClick={() => onChange({ ...value, shape: s.id })}
              className="flex flex-col items-center gap-1 rounded-md border p-1 transition hover:bg-muted"
            >
              <BloubAvatar
                size={40}
                shape={s.id}
                color={value.color}
                expression={value.expression}
                frozenAt={1}
              />
              <span className="text-[10px]">{SHAPE_LABELS[s.id] ?? s.id}</span>
            </button>
          ))}
        </div>
      </CardContent>

      <CardHeader>
        <CardTitle className="text-sm">Expression</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-1.5">
          {EXPRESSIONS.map((e: BotExpression) => (
            <button
              key={e.id}
              type="button"
              aria-label={EXPRESSION_LABELS[e.id] ?? e.id}
              aria-pressed={value.expression === e.id}
              onClick={() => onChange({ ...value, expression: e.id })}
              className="flex flex-col items-center gap-1 rounded-md border p-1 transition hover:bg-muted"
            >
              <BloubAvatar
                size={40}
                shape={value.shape}
                color={value.color}
                expression={e.id}
                frozenAt={1}
              />
              <span className="text-[10px]">
                {EXPRESSION_LABELS[e.id] ?? e.id}
              </span>
            </button>
          ))}
        </div>
      </CardContent>

      <CardHeader>
        <CardTitle className="text-sm">Color</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-1.5">
          {COLORS.map((c: BotColor) => (
            <button
              key={c.id}
              type="button"
              aria-label={COLOR_LABELS[c.id] ?? c.id}
              aria-pressed={value.color === c.id}
              onClick={() => onChange({ ...value, color: c.id })}
              className="flex aspect-square items-center justify-center rounded-full border-2 transition"
              style={{
                borderColor:
                  value.color === c.id ? "var(--foreground)" : "transparent",
              }}
            >
              <span
                className="block size-[60%] rounded-full ring-1 ring-black/10 ring-inset"
                style={{ background: c.hex }}
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
