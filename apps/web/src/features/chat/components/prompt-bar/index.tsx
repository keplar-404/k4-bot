"use client";
import { useEffect } from "react";
import { ComposerShell } from "./composer-shell";
import { EffortMenu } from "./effort-menu";
import { Icon } from "./icons";
import { useModeEffects } from "./mode-effects";
import { ModeMenu } from "./mode-menu";
import { useModeState } from "./mode-state";
import { ModelMenu } from "./model-menu";
import { PlusMenu } from "./plus-menu";
import { usePromptEffects } from "./prompt-effects";
import { usePromptEffects2 } from "./prompt-effects2";
import { usePromptHandlers } from "./prompt-handlers";
import { usePromptHandlers2 } from "./prompt-handlers2";
import { usePromptState } from "./prompt-state";
import type { ComposerAttachment, ModelOption } from "./types";
export default function PromptBar({
  placeholder,
  onSend,
  models: externalModels,
  modelKey,
  effort = null,
  onSelect,
  mode,
  onModeChange,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  busy = false,
  responding = false,
  onStop,
}: {
  placeholder?: string;
  onSend?: (text: string) => void;
  onAttach?: (files: File[]) => void;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (key: string) => void;
  busy?: boolean;
  responding?: boolean;
  onStop?: () => void;
  models?: ModelOption[];
  modelKey?: string;
  effort?: string | null;
  onSelect?: (modelKey: string, effort: string | null) => void;
  mode?: "allow_all" | "plan" | "ask";
  onModeChange?: (mode: "allow_all" | "plan" | "ask") => void;
}) {
  const state = usePromptState();
  const modeState = useModeState();
  const props = {
    placeholder,
    onSend,
    models: externalModels,
    modelKey,
    effort,
    onSelect,
    mode,
    onModeChange,
    attachments,
    onAttach,
    onRemoveAttachment,
    busy,
    responding,
    onStop,
  };
  const h = usePromptHandlers(state, props);
  const h2 = usePromptHandlers2(state, props, h);
  const merged = { ...h, ...h2, ...modeState, mode, onModeChange };
  usePromptEffects(state, merged);
  usePromptEffects2(state, merged);
  useModeEffects(state, merged);
  const takeFiles = merged.takeFiles;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target for files; the + menu and paste do the same by keyboard
    <div
      data-promptbar
      className="w-full"
      onDragOver={(event) => {
        if (!onAttach || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        state.setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          state.setDragging(false);
      }}
      onDrop={(event) => {
        if (!onAttach) return;
        event.preventDefault();
        state.setDragging(false);
        takeFiles(event.dataTransfer.files);
        state.inputRef.current?.focus();
      }}
    >
      {onAttach && (
        <input
          ref={state.fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      )}
      <div ref={state.composerAnchorRef} className="relative">
        <PlusMenu state={state} h={merged} props={props} />
        <ModelMenu state={state} h={merged} />
        <EffortMenu state={state} h={merged} />
        <ModeMenu state={state} modeState={merged} h={merged} />
        <ComposerShell state={state} props={props} h={merged} />
      </div>
    </div>
  );
}
