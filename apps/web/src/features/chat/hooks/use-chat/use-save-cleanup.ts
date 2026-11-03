import { useEffect, useRef } from "react";

export function useSaveCleanup(
  saveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  pendingSaveRef: React.MutableRefObject<(() => void) | null>,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and setters are stable; deps preserved from original
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingSaveRef.current?.();
    },
    [],
  );
}
