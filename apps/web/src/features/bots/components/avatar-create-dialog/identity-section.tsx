"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_ROLE_TITLE, ROLES } from "@/features/bots/roles";
import type { BotForm } from "./use-bot-form";

export function IdentitySection({ form }: { form: BotForm }) {
  return (
    <>
      <div className="w-full space-y-2">
        <Label htmlFor="av-name">Name</Label>
        <Input
          ref={form.nameRef}
          id="av-name"
          placeholder="Bot name"
          value={form.name}
          onChange={(e) => {
            form.setName(e.target.value);
            form.setExpression("attentif");
            form.setLookAt(form.nameCaretLook());
          }}
          onFocus={() => {
            form.setExpression("attentif");
            form.setLookAt(form.nameCaretLook());
          }}
          onClick={() => form.setLookAt(form.nameCaretLook())}
          onKeyUp={() => form.setLookAt(form.nameCaretLook())}
          onBlur={() => {
            form.setLookAt({ nx: 0, ny: 0.6 });
            if (form.name.trim().length > 0) {
              form.setExpression("heureux");
              setTimeout(() => form.setExpression("neutre"), 1200);
            } else {
              form.setExpression("neutre");
            }
          }}
        />
      </div>
      <fieldset className="w-full space-y-2">
        <legend className="text-sm leading-none font-medium">Role</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={form.role === r.id}
              onClick={() => {
                form.setRole(r.id);
                form.applyRoleDefaults(r.id);
              }}
              className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition hover:bg-muted ${
                form.role === r.id
                  ? "border-primary ring-2 ring-primary/40"
                  : ""
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <r.icon className="size-4 shrink-0" />
                {r.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.description}
              </span>
            </button>
          ))}
        </div>
        {form.role === "custom" && (
          <Input
            aria-label="Custom role"
            placeholder="e.g. Travel planner, Math tutor, Customer support"
            maxLength={MAX_ROLE_TITLE}
            value={form.roleTitle}
            onChange={(e) => form.setRoleTitle(e.target.value)}
          />
        )}
      </fieldset>
    </>
  );
}
