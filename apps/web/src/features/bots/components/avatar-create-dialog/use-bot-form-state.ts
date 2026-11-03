"use client";

import { COLORS } from "@/features/avatar/bloub/bot/skins";
import type { Bot } from "@/features/bots/api";
import { useDomains } from "@/features/bots/domains";
import { useIntegrations } from "@/features/integrations/api";
import { useBotFormFields } from "./use-bot-form-fields";
import { useBotFormMeta } from "./use-bot-form-meta";

export function useBotFormState(args: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  bot?: Bot | undefined;
}) {
  const fields = useBotFormFields();
  const meta = useBotFormMeta(args.bot);
  const internalOpen = meta.internalOpen;
  const setInternalOpen = meta.setInternalOpen;
  const open = args.open ?? internalOpen;
  const setOpen = args.onOpenChange ?? setInternalOpen;
  const isEditing = Boolean(args.bot);

  const domains = useDomains();
  const { skills: installedSkills, mcp: installedApps } = useIntegrations();

  return {
    open,
    setOpen,
    internalOpen,
    setInternalOpen,
    openProp: args.open,
    onOpenChange: args.onOpenChange,
    isEditing,
    bot: args.bot,
    ...fields,
    submitting: meta.submitting,
    setSubmitting: meta.setSubmitting,
    caps: meta.caps,
    setCaps: meta.setCaps,
    capsTouched: meta.capsTouched,
    setCapsTouched: meta.setCapsTouched,
    picksTouched: meta.picksTouched,
    setPicksTouched: meta.setPicksTouched,
    lookAt: meta.lookAt,
    setLookAt: meta.setLookAt,
    descRef: meta.descRef,
    nameRef: meta.nameRef,
    domains,
    installedSkills,
    installedApps,
    FALLBACK_DEFAULTS: meta.FALLBACK_DEFAULTS,
    COLORS,
  };
}
