"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BlockBody } from "../../blocks";

type Config = Extract<BlockBody, { kind: "trigger.webhook" }>["config"];
const BODY = `{"name":"Ada","email":"ada@example.com"}`;

/** A ready-to-run request for the chosen check (the URL itself is shown once, when the workflow is turned on). */
function sample(c: Config): string {
  const url = "'<your webhook URL>'";
  const json = "-H 'content-type: application/json'";
  if (c.auth === "header")
    return `curl -X POST ${url} \\\n  ${json} \\\n  -H '${c.headerName}: <your secret>' \\\n  -d '${BODY}'`;
  if (c.auth === "hmac") {
    return [
      `BODY='${BODY}'`,
      "SIG=$(printf '%s' \"$BODY\" | openssl dgst -sha256 -hmac '<your secret>' -hex | sed 's/^.* //')",
      `curl -X POST ${url} \\\n  ${json} \\\n  -H "${c.signatureHeader}: ${c.signaturePrefix}$SIG" \\\n  -d "$BODY"`,
    ].join("\n");
  }
  return `curl -X POST ${url} \\\n  ${json} \\\n  -d '${BODY}'`;
}

export function WebhookSamples({ config }: { config: Config }) {
  const text = sample(config);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">From a terminal</span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Copy the example"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success("Example copied");
          }}
        >
          <CopyIcon />
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[11px]">
        {text}
      </pre>
      <p className="text-muted-foreground text-xs">
        Answers 202 with a run id. Only JSON, up to 256 KB. Limits: 60 runs a
        minute per workflow, and per sender.
        {config.auth === "hmac" &&
          " The signature is the HMAC-SHA256 of the exact body bytes, in hex."}
      </p>
    </div>
  );
}
