"use client";

import { Button } from "@/components/ui/button";
import type { BotForm } from "./use-bot-form";

export function ActionsSection({ form }: { form: BotForm }) {
  return (
    <div className="flex w-full gap-2">
      <Button
        className="flex-1"
        disabled={form.submitting}
        onClick={form.handleSubmit}
      >
        {form.submitting
          ? form.isEditing
            ? "Saving…"
            : "Creating…"
          : form.isEditing
            ? "Save changes"
            : "Create"}
      </Button>
      <Button
        variant="outline"
        className="flex-1"
        disabled={form.submitting}
        onClick={form.handleCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
