import type { BotFrame } from "@/features/avatar/bloub/bot/engine";
import { DEMI_VIEWBOX as VB } from "@/features/avatar/bloub/bot/repere";

/** The body mask (eyes and notch cut out) and one gradient per arc. */
export function BloubDefs({
  frame,
  uid,
  maskId,
}: {
  frame: BotFrame;
  uid: string;
  maskId: string;
}) {
  return (
    <defs>
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x={-VB}
        y={-VB}
        width={VB * 2}
        height={VB * 2}
      >
        <path d={frame.bodyPath} fill="#fff" />
        {frame.eyes.map((eye) => (
          <path
            key={eye.matrix}
            d={eye.d}
            transform={eye.matrix}
            opacity={eye.alpha}
            fill="#000"
          />
        ))}
        {frame.notch && (
          <circle
            cx={frame.notch.x}
            cy={frame.notch.y}
            r={frame.notch.r}
            fill="#000"
          />
        )}
      </mask>
      {frame.arcs.map((arc) => (
        <linearGradient
          key={arc.id}
          id={`${uid}-${arc.id}`}
          gradientUnits="userSpaceOnUse"
          x1={arc.grad.x1}
          y1={arc.grad.y1}
          x2={arc.grad.x2}
          y2={arc.grad.y2}
        >
          {arc.grad.stops.map((c, i) => (
            <stop
              key={`${i}-${c}`}
              offset={i / (arc.grad.stops.length - 1)}
              stopColor={c}
            />
          ))}
        </linearGradient>
      ))}
    </defs>
  );
}
