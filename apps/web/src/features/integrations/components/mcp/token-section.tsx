"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogMcp, InstalledMcp } from "@/features/integrations/api";
import { ConnectForm } from "./connect-form";

/** The app's token: its saved hint with Replace, or the form to connect. */
export function TokenSection({
  server,
  installed,
}: {
  server: CatalogMcp;
  installed?: InstalledMcp;
}) {
  const [replacing, setReplacing] = useState(false);
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        <KeyRoundIcon className="size-4" />
        {installed ? "Token" : "Connect your account"}
      </h4>
      {installed && !replacing ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Saved, encrypted, ending in{" "}
            <span className="font-mono">{installed.secretHint}</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReplacing(true)}
          >
            Replace token
          </Button>
        </div>
      ) : (
        <ConnectForm
          server={server}
          replace={installed}
          onDone={() => setReplacing(false)}
        />
      )}
    </section>
  );
}
