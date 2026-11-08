import { useRef, useState } from "react";

/** Mode picker state (Allow all / Plan / Ask), kept separate so prompt-state stays under 100 lines. */
export function useModeState() {
  const [modeOpen, setModeOpen] = useState(false);
  const [modeBox, setModeBox] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const [modeHovered, setModeHovered] = useState<number | null>(null);
  const [modeMenuLeft, setModeMenuLeft] = useState(0);
  const [modeMenuBottom, setModeMenuBottom] = useState(0);
  const modeRef = useRef<HTMLButtonElement>(null);
  const modeRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  return {
    modeOpen,
    setModeOpen,
    modeBox,
    setModeBox,
    modeHovered,
    setModeHovered,
    modeMenuLeft,
    setModeMenuLeft,
    modeMenuBottom,
    setModeMenuBottom,
    modeRef,
    modeRowRefs,
  };
}

export type ModeState = ReturnType<typeof useModeState>;
