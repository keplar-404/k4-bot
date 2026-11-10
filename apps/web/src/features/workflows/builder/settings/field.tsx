import type { ReactNode } from "react";
import {
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Field as UiField,
} from "@/components/ui/field";
import { useLocalStore } from "@/lib/store/local-store";

const SHORT_HINT = 140;

/**
 * A labelled setting (shadcn Field), laid out like Zapier's: name with a "required" mark, what to put in it, then the
 * control. A long
 * description (apps explain where a value comes from) opens in full on "More". `meta` is a line such as
 * "number · default 10 · e.g. me". No box around it: settings read as one flat list, like an inspector.
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
  const [{ open }, set] = useLocalStore(() => ({ open: false }));
  const long = (hint?.length ?? 0) > SHORT_HINT;
  return (
    <UiField className="min-w-0 gap-1.5">
      <FieldLabel htmlFor={id} className="font-medium text-xs">
        {label}
        {required && (
          <span className="-ml-1.5 text-destructive" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </FieldLabel>
      {hint && (
        <FieldDescription className="text-xs leading-relaxed">
          {long && !open
            ? `${hint.slice(0, SHORT_HINT).trimEnd()}… `
            : `${hint} `}
          {long && (
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => set({ open: !open })}
            >
              {open ? "Less" : "More"}
            </button>
          )}
        </FieldDescription>
      )}
      {children}
      {meta && (
        <FieldDescription className="text-[11px]">{meta}</FieldDescription>
      )}
    </UiField>
  );
}

/**
 * A group of settings (shadcn FieldSet): a small heading, then its fields. Groups are divided by a thin line, never
 * boxed; a group inside another (e.g. the HTTP body) is just a sub-heading, with no line or extra padding.
 */
export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <FieldSet
      data-settings-section=""
      className="min-w-0 gap-4 border-t px-4 py-5 first:border-t-0 in-data-settings-section:border-t-0 in-data-settings-section:px-0 in-data-settings-section:py-0"
    >
      <FieldLegend
        variant="label"
        className="mb-0 font-semibold text-foreground text-sm"
      >
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}
