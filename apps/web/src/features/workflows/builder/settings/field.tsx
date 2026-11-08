import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** A labelled setting: name, optional "required" mark, the control, and a hint under it. */
export function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </Label>
      {children}
      {hint && (
        <p className="line-clamp-3 text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

/** A settings group with a small heading. */
export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t px-4 py-4 first:border-t-0">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}
