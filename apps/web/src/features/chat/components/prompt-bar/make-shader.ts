import { createShader } from "glimm";

import type { PromptState } from "./prompt-state";
export function makeShader(
  state: PromptState,
): ReturnType<typeof createShader> | null {
  const canvas = state.glimmRef.current;
  if (!canvas) return null;
  const random = Math.random;
  Math.random = () => 0;
  try {
    return createShader({
      canvas,
      palette: state.RAINBOW,
      direction: "ltr",
      bandTight: 10,
      swellAmount: 0.85,
    });
  } finally {
    Math.random = random;
  }
}
