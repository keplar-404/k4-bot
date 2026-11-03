"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type BotExpression,
  EXPRESSIONS,
} from "@/features/avatar/bloub/bot/expressions";
import { type BotShape, SHAPES } from "@/features/avatar/bloub/bot/skins";
import {
  EXPRESSION_LABELS,
  SHAPE_LABELS,
} from "@/features/avatar/bloub/labels";
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import { ColorPicker } from "./color-picker";

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

      <ColorPicker
        value={value.color}
        onChange={(color) => onChange({ ...value, color })}
      />
    </Card>
  );
}
