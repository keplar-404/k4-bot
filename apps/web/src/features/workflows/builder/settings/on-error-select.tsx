"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "./field";

/** "After the last try" picker: stop the workflow or continue with the next steps. */
export function OnErrorSelect({
  value,
  onChange,
}: {
  value: "stop" | "continue";
  onChange: (v: "stop" | "continue") => void;
}) {
  return (
    <Field id="on-error" label="After the last try">
      <Select
        value={value}
        onValueChange={(v) => onChange(v as "stop" | "continue")}
      >
        <SelectTrigger id="on-error" className="w-full">
          <SelectValue>
            {value === "stop"
              ? "Stop the workflow"
              : "Continue with the next steps"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="stop">Stop the workflow</SelectItem>
          <SelectItem value="continue">Continue with the next steps</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}
