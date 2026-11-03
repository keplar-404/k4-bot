"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BotForm } from "./use-bot-form";

export function DescriptionSection({ form }: { form: BotForm }) {
  return (
    <div className="w-full space-y-2">
      <Label htmlFor="av-desc">Description</Label>
      <Textarea
        ref={form.descRef}
        id="av-desc"
        placeholder="Describe this bot"
        className="h-20 resize-none"
        value={form.description}
        onChange={(e) => {
          form.setDescription(e.target.value);
          form.setExpression("attentif");
          form.setLookAt(form.caretLook());
        }}
        onFocus={() => {
          form.setExpression("attentif");
          form.setLookAt(form.caretLook());
        }}
        onClick={() => form.setLookAt(form.caretLook())}
        onKeyUp={() => form.setLookAt(form.caretLook())}
        onBlur={() => {
          form.setLookAt({ nx: 0, ny: 0.6 });
          if (form.description.trim().length > 0) {
            form.setExpression("heureux");
            setTimeout(() => form.setExpression("neutre"), 1200);
          } else {
            form.setExpression("neutre");
          }
        }}
        rows={3}
      />
    </div>
  );
}
