"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, SettingsSection } from "./field";
import { OnErrorSelect } from "./on-error-select";

export type Retry = {
  maxAttempts: number;
  delaySeconds: number;
  backoff: "constant" | "exponential";
};
type Props = {
  retry: Retry | undefined;
  onError: "stop" | "continue";
  onRetry: (r: Retry) => void;
  onOnError: (v: "stop" | "continue") => void;
};

const DEFAULT: Retry = {
  maxAttempts: 1,
  delaySeconds: 10,
  backoff: "exponential",
};
const clamp = (v: string, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.parseInt(v, 10) || min));

/** n8n-style "Retry on fail" for one block, and what happens when it still fails. */
export function RetrySettings({
  retry = DEFAULT,
  onError,
  onRetry,
  onOnError,
}: Props) {
  return (
    <SettingsSection title="If it fails">
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="retry-attempts"
          label="Tries in total"
          hint="1 means no retry, up to 5. Only errors that may pass (a busy service, a timeout) are tried again."
        >
          <Input
            id="retry-attempts"
            type="number"
            min={1}
            max={5}
            value={retry.maxAttempts}
            onChange={(e) =>
              onRetry({ ...retry, maxAttempts: clamp(e.target.value, 1, 5) })
            }
          />
        </Field>
        <Field
          id="retry-delay"
          label="Wait before trying again (seconds)"
          hint="The pause before the 2nd try."
        >
          <Input
            id="retry-delay"
            type="number"
            min={1}
            max={3600}
            disabled={retry.maxAttempts === 1}
            value={retry.delaySeconds}
            onChange={(e) =>
              onRetry({
                ...retry,
                delaySeconds: clamp(e.target.value, 1, 3600),
              })
            }
          />
        </Field>
      </div>
      <Field
        id="retry-backoff"
        label="Later waits"
        hint="Keep the same wait, or double it each time (gentler on a busy service)."
      >
        <Select
          value={retry.backoff}
          disabled={retry.maxAttempts === 1}
          onValueChange={(v) =>
            onRetry({ ...retry, backoff: v as Retry["backoff"] })
          }
        >
          <SelectTrigger id="retry-backoff" className="w-full">
            <SelectValue>
              {retry.backoff === "exponential"
                ? "Wait longer each time"
                : "Same wait each time"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exponential">Wait longer each time</SelectItem>
            <SelectItem value="constant">Same wait each time</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <OnErrorSelect value={onError} onChange={onOnError} />
    </SettingsSection>
  );
}
