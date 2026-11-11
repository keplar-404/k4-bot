"use client";

import { SparklesIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isWorking } from "./api";
import { useAssistant } from "./store";

/** The top bar's Ask button (Ctrl/Cmd + I): opens or closes the assistant. A dot shows while it is working. */
export function AssistantButton() {
  const open = useAssistant((s) => s.open);
  const working = useAssistant((s) => isWorking(s.run?.status));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        useAssistant.getState().setOpen(!useAssistant.getState().open);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <Button
      size="sm"
      variant={open ? "secondary" : "outline"}
      className="relative"
      aria-pressed={open}
      title="Ask the assistant (Ctrl+I)"
      onClick={() => useAssistant.getState().setOpen(!open)}
    >
      <SparklesIcon />
      Ask
      {working && (
        <span className="absolute -top-1 -right-1 size-2.5 animate-pulse rounded-full bg-primary">
          <span className="sr-only">(working)</span>
        </span>
      )}
    </Button>
  );
}
