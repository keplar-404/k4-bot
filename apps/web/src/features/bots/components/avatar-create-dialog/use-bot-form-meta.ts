"use client";

import { useRef, useState } from "react";
import type { Bot } from "@/features/bots/api";
import type { Capabilities } from "@/features/bots/components/bot-capabilities";
import { FALLBACK_DEFAULTS } from "@/features/bots/domains";
export function useBotFormMeta(bot: Bot | undefined) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [caps, setCaps] = useState<Capabilities>({
    subagentsEnabled: FALLBACK_DEFAULTS.subagents,
    maxSubagents: FALLBACK_DEFAULTS.maxSubagents,
    maxParallelTools: FALLBACK_DEFAULTS.maxParallelTools,
  });
  const [capsTouched, setCapsTouched] = useState(false);
  const [picksTouched, setPicksTouched] = useState(false);
  const [lookAt, setLookAt] = useState<{ nx: number; ny: number } | null>({
    nx: 0,
    ny: 0.6,
  });
  const descRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  return {
    internalOpen,
    setInternalOpen,
    submitting,
    setSubmitting,
    caps,
    setCaps,
    capsTouched,
    setCapsTouched,
    picksTouched,
    setPicksTouched,
    lookAt,
    setLookAt,
    descRef,
    nameRef,
    FALLBACK_DEFAULTS,
  };
}
