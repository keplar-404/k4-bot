import { playSweep } from "glimm";
import { COMMANDS, parseToken } from "./data";
import { makeShader as makeShaderImpl } from "./make-shader";
import type { PromptState } from "./prompt-state";
import type { ModelOption, PromptBarProps } from "./types";
export function usePromptHandlers(state: PromptState, props: PromptBarProps) {
  const catalog = props.models ?? [];
  const model =
    catalog.find((m: ModelOption) => m.key === props.modelKey) ?? catalog[0];
  const efforts = model?.reasoningEfforts ?? [];
  const effort = props.effort ?? null;
  const effortIndex = effort ? efforts.indexOf(effort) : -1;
  const modelIndex = catalog.findIndex(
    (m: ModelOption) => m.key === model?.key,
  );
  const token = state.dismissed ? null : parseToken(state.draft);
  const menu: "at" | "slash" | null = state.plusOpen
    ? "at"
    : (token?.kind ?? null);
  const query = state.plusOpen ? "" : (token?.query ?? "");
  const rows: { key: string; name: string; desc: string }[] =
    menu === "at"
      ? (props.sources ?? [])
          .filter((s) => props.onAttach || !s.attach)
          .map((s) => ({ key: s.key, name: s.name, desc: s.desc }))
      : menu === "slash"
        ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query)).map(
            (c) => ({ key: c.key, name: c.name, desc: c.desc }),
          )
        : [];
  const canSend =
    !props.busy &&
    (state.draft.trim().length > 0 || (props.attachments?.length ?? 0) > 0);

  const makeShader = () => makeShaderImpl(state);
  const celebrate = () => {
    if (state.sweepingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    state.shaderRef.current?.destroy();
    const shader = makeShaderImpl(state);
    state.shaderRef.current = shader;
    if (!shader) return;
    state.sweepingRef.current = true;
    const sweep = playSweep(shader, {
      palette: state.RAINBOW,
      direction: "ltr",
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: "easeOutExpo",
    });
    sweep.done.finally(() => {
      state.sweepingRef.current = false;
    });
  };
  const selectModel = (next: ModelOption) => {
    const isFlagship = next.key === catalog[0]?.key;
    state.setModelOpen(false);
    state.setEffortOpen(false);
    props.onSelect?.(next.key, next.reasoningEfforts?.[0] ?? null);
    if (isFlagship) celebrate();
  };
  return {
    catalog,
    model,
    efforts,
    effort,
    effortIndex,
    modelIndex,
    token,
    menu,
    query,
    rows,
    canSend,
    makeShader,
    celebrate,
    selectModel,
    onSelect: props.onSelect,
  };
}
export type PromptHandlers = ReturnType<typeof usePromptHandlers>;
