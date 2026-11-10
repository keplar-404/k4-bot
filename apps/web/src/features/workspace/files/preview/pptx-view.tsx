"use client";

import { useEffect, useRef } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/**
 * PowerPoint slides rendered in the browser by @aiden0z/pptx-renderer (loaded only when a .pptx opens).
 * Its recommended zip limits guard against oversized or hostile archives.
 */
export function PptxView({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ error }, , store] = useLocalStore(() => ({
    error: null as string | null,
  }));
  const setError = fieldSetter(store, "error");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let viewer: { destroy(): void } | undefined;
    let live = true;
    void Promise.all([import("@aiden0z/pptx-renderer"), blob.arrayBuffer()])
      .then(async ([{ PptxViewer, RECOMMENDED_ZIP_LIMITS }, data]) => {
        if (!live) return;
        viewer = await PptxViewer.open(data, el, {
          zipLimits: RECOMMENDED_ZIP_LIMITS,
          listOptions: { windowed: true },
        });
        if (!live) viewer.destroy();
      })
      .catch(
        () =>
          live &&
          setError(
            "These slides could not be shown. Download the file instead.",
          ),
      );
    return () => {
      live = false;
      viewer?.destroy();
    };
  }, [blob, setError]);

  if (error)
    return <p className="p-4 text-sm text-muted-foreground">{error}</p>;
  return <div ref={ref} className="overflow-auto bg-muted/40" />;
}
