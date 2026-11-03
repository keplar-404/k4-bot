"use client";

import { BotIntegrationsPicker } from "@/features/integrations/components/bot-integrations-picker";
import type { BotForm } from "./use-bot-form";

export function IntegrationsSection({ form }: { form: BotForm }) {
  return (
    <BotIntegrationsPicker
      role={form.role}
      skillIds={form.skillIds}
      mcpServerIds={form.mcpServerIds}
      onSkillsChange={(ids) => {
        form.setPicksTouched(true);
        form.setSkillIds(ids);
      }}
      onMcpChange={(ids) => {
        form.setPicksTouched(true);
        form.setMcpServerIds(ids);
      }}
    />
  );
}
