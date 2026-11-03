"use client";

import { BotCapabilities } from "@/features/bots/components/bot-capabilities";
import type { BotForm } from "./use-bot-form";

export function CapabilitiesSection({ form }: { form: BotForm }) {
  return (
    <BotCapabilities
      value={form.caps}
      onChange={(next) => {
        form.setCapsTouched(true);
        form.setCaps(next);
      }}
    />
  );
}
