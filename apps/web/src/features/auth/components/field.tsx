import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A labelled input of an auth form; `onValue` gets the text. */
export function Field({
  id,
  label,
  onValue,
  ...input
}: { id: string; label: string; onValue: (value: string) => void } & Omit<
  ComponentProps<typeof Input>,
  "id" | "onChange"
>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} onChange={(e) => onValue(e.target.value)} {...input} />
    </div>
  );
}
