"use client";

import { useCallback, useEffect } from "react";
import type { ColorId, ShapeId } from "@/features/avatar/bloub/bot/skins";
import type { Bot, CreateBotInput } from "@/features/bots/api";
import { DEFAULT_ROLE, type RoleId } from "@/features/bots/roles";
import { applyRoleDefaultsImpl } from "./role-defaults";
import { useBotFormState } from "./use-bot-form-state";

export function useBotFormEffects(args: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  bot?: Bot | undefined;
  onSubmit: (input: CreateBotInput) => Promise<unknown>;
}) {
  const state = useBotFormState(args);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the setters are stable state setters
  const applyRoleDefaults = useCallback(
    (next: RoleId) =>
      applyRoleDefaultsImpl(next, {
        domains: state.domains,
        capsTouched: state.capsTouched,
        picksTouched: state.picksTouched,
        isEditing: state.isEditing,
        installedSkills: state.installedSkills,
        installedApps: state.installedApps,
        setCaps: state.setCaps,
        setSkillIds: state.setSkillIds,
        setMcpServerIds: state.setMcpServerIds,
      }),
    [
      state.domains,
      state.capsTouched,
      state.picksTouched,
      state.isEditing,
      state.installedSkills,
      state.installedApps,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the dialog opens or the defaults load, not on every role pick
  useEffect(() => {
    if (state.open && !state.isEditing) applyRoleDefaults(state.role);
  }, [state.open, state.isEditing, state.domains]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resets the form only when the dialog opens or the bot changes
  useEffect(() => {
    if (!state.open) return;
    state.setCapsTouched(false);
    state.setPicksTouched(false);
    state.setCaps({
      subagentsEnabled:
        state.bot?.subagentsEnabled ?? state.FALLBACK_DEFAULTS.subagents,
      maxSubagents:
        state.bot?.maxSubagents ?? state.FALLBACK_DEFAULTS.maxSubagents,
      maxParallelTools:
        state.bot?.maxParallelTools ?? state.FALLBACK_DEFAULTS.maxParallelTools,
    });
    state.setName(state.bot?.name ?? "");
    state.setDescription(state.bot?.description ?? "");
    state.setRole((state.bot?.role as RoleId) ?? DEFAULT_ROLE);
    state.setRoleTitle(state.bot?.roleTitle ?? "");
    state.setSkillIds(state.bot?.skillIds ?? []);
    state.setMcpServerIds(state.bot?.mcpServerIds ?? []);
    state.setComposioToolkits(
      state.bot?.composioApps?.map((a) => a.toolkit) ?? [],
    );
    state.setComposioAllowWrites(
      Object.fromEntries(
        (state.bot?.composioApps ?? []).map((a) => [
          a.toolkit,
          a.allowWrites ?? true,
        ]),
      ),
    );
    state.setShape((state.bot?.shape as ShapeId) ?? state.SHAPES[0].id);
    state.setColor((state.bot?.color as ColorId) ?? "encre");
    state.setExpression("neutre");
  }, [state.open, state.bot]);

  return { ...state, applyRoleDefaults };
}
