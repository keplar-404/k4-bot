"use client";

import { useEffect, useRef } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** A Word document with its page layout, rendered in the browser by docx-preview (loaded only when a .docx opens). */
export function DocxView({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ error }, , store] = useLocalStore(() => ({
    error: null as string | null,
  }));
  const setError = fieldSetter(store, "error");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    void import("docx-preview")
      .then(
        ({ renderAsync }) =>
          live &&
          renderAsync(blob, el, undefined, {
            inWrapper: true,
            ignoreLastRenderedPageBreak: false,
          }),
      )
      .catch(
        () =>
          live &&
          setError(
            "This Word document could not be shown. Download it instead.",
          ),
      );
    return () => {
      live = false;
      el.replaceChildren();
    };
  }, [blob, setError]);

  if (error)
    return <p className="p-4 text-sm text-muted-foreground">{error}</p>;
  return <div ref={ref} className="overflow-auto bg-muted/40" />;
}
