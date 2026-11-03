"use client";

import { useCallback } from "react";
import type { Bot, CreateBotInput } from "@/features/bots/api";
import type { RoleId } from "@/features/bots/roles";
import { caretLookImpl, nameCaretLookImpl } from "./caret-look";
import { submitBot } from "./submit-bot";
import { useBotFormEffects } from "./use-bot-form-effects";

export type BotForm = ReturnType<typeof useBotForm>;

export function useBotForm(args: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  bot?: Bot | undefined;
  onSubmit: (input: CreateBotInput) => Promise<unknown>;
}) {
  const state = useBotFormEffects(args);

  const nameCaretLook = () => nameCaretLookImpl(state.nameRef.current);
  const caretLook = useCallback(
    () => caretLookImpl(state.descRef.current),
    [state.descRef],
  );
  const handleCancel = useCallback(() => state.setOpen(false), [state.setOpen]);
  const handleSubmit = useCallback(async () => {
    await submitBot({
      name: state.name,
      description: state.description,
      role: state.role,
      roleTitle: state.roleTitle,
      skillIds: state.skillIds,
      mcpServerIds: state.mcpServerIds,
      caps: state.caps,
      shape: state.shape,
      color: state.color,
      setOpen: state.setOpen,
      setSubmitting: state.setSubmitting,
      setExpression: state.setExpression,
      onSubmit: args.onSubmit,
      submitting: state.submitting,
      isEditing: state.isEditing,
    });
  }, [
    state.name,
    state.description,
    state.role,
    state.roleTitle,
    state.skillIds,
    state.mcpServerIds,
    state.caps,
    state.shape,
    state.color,
    state.setOpen,
    state.setSubmitting,
    state.setExpression,
    args.onSubmit,
    state.submitting,
    state.isEditing,
  ]);

  return {
    ...state,
    nameCaretLook,
    caretLook,
    handleCancel,
    handleSubmit,
  };
}
