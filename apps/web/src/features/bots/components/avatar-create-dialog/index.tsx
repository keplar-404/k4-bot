"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Bot, CreateBotInput } from "@/features/bots/api";
import { ActionsSection } from "./actions-section";
import { AppsSection } from "./apps-section";
import { AvatarSection } from "./avatar-section";
import { CapabilitiesSection } from "./capabilities-section";
import { DescriptionSection } from "./description-section";
import { IdentitySection } from "./identity-section";
import { IntegrationsSection } from "./integrations-section";
import { useBotForm } from "./use-bot-form";

export function AvatarCreateDialog({
  open: openProp,
  onOpenChange,
  trigger,
  bot,
  onSubmit,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: boolean;
  bot?: Bot;
  onSubmit: (input: CreateBotInput) => Promise<unknown>;
}) {
  const form = useBotForm({ open: openProp, onOpenChange, bot, onSubmit });

  return (
    <Dialog open={form.open} onOpenChange={form.setOpen}>
      {trigger && (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PlusIcon />
          <span className="sr-only">Create avatar</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] max-w-3xl gap-4 overflow-y-auto p-5">
        <DialogHeader className="items-center text-center">
          <DialogTitle>
            {form.isEditing ? "Edit Bot" : "Create Avatar"}
          </DialogTitle>
          <DialogDescription>
            {form.isEditing
              ? "Update your bot's identity and appearance."
              : "Configure your bot's identity and appearance."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6">
          <AvatarSection form={form} />
          <IdentitySection form={form} />
          <IntegrationsSection form={form} />
          <AppsSection form={form} />
          <CapabilitiesSection form={form} />
          <DescriptionSection form={form} />
          <ActionsSection form={form} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
