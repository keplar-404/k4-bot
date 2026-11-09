import { type ReactNode, useState } from "react";
import { Label } from "@/components/ui/label";

const SHORT_HINT = 160;

/**
 * A labelled setting: name, optional "required" mark, the control, and a hint under it. A long hint (apps explain
 * where a value comes from, e.g. "get message IDs from Fetch emails") opens in full on "More". `meta` is a line such as
 * "number · default 10 · e.g. me".
 */
export function Field({
  id,
  label,
  required,
  hint,
  meta,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  meta?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const long = (hint?.length ?? 0) > SHORT_HINT;
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
      {meta && <p className="text-[11px] text-muted-foreground">{meta}</p>}
      {hint && (
        <p className="text-muted-foreground text-xs">
          {long && !open
            ? `${hint.slice(0, SHORT_HINT).trimEnd()}… `
            : `${hint} `}
          {long && (
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Less" : "More"}
            </button>
          )}
        </p>
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
