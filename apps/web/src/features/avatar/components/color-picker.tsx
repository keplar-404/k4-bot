"use client";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BotColor, COLORS } from "@/features/avatar/bloub/bot/skins";
import { COLOR_LABELS } from "@/features/avatar/bloub/labels";

/** The avatar's colour swatches; the selected one is ringed. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <>
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
              aria-pressed={value === c.id}
              onClick={() => onChange(c.id)}
              className="flex aspect-square items-center justify-center rounded-full border-2 transition"
              style={{
                borderColor:
                  value === c.id ? "var(--foreground)" : "transparent",
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
    </>
  );
}
