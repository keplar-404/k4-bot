import type { BotFrame } from "@/features/avatar/bloub/bot/engine";
import { RAYON as R } from "@/features/avatar/bloub/bot/repere";
import { mixHex } from "@/features/avatar/bloub/bot/skins";

/** The decorative dots, tinted by depth between the paper and the ink. `prefix` keeps keys unique per layer. */
export function BloubDots({
  frame,
  ink,
  paper,
  prefix,
}: {
  frame: BotFrame;
  ink: string;
  paper: string;
  prefix: string;
}) {
  return (
    <g>
      {frame.dots.map((dot) => {
        const fill =
          dot.color ??
          (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth));
        if (dot.d) {
          return (
            <path
              key={`${prefix}-${dot.x}-${dot.y}`}
              d={dot.d}
              transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
              fill={fill}
              opacity={dot.opacity}
            />
          );
        }
        return (
          <circle
            key={`${prefix}-${dot.x}-${dot.y}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill={fill}
            opacity={dot.opacity}
          />
        );
      })}
    </g>
  );
}
