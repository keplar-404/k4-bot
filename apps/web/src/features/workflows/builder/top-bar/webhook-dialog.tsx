"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Shows a new webhook URL once: only its hash is kept, so it cannot be shown again (make a new one if lost). */
export function WebhookDialog({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={url !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your webhook URL</DialogTitle>
          <DialogDescription>
            Send a POST request with a JSON body to this URL to start the
            workflow. Copy it now: for your security it is shown only once.
            Treat it like a password.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            readOnly
            value={url ?? ""}
            className="font-mono text-xs"
            aria-label="Webhook URL"
            onFocus={(e) => e.target.select()}
          />
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(url ?? "");
              toast.success("Webhook URL copied");
            }}
          >
            <CopyIcon />
            Copy
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground text-xs">
            Try it from a terminal
          </span>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[11px]">
            {`curl -X POST '${url ?? ""}' \\
  -H 'content-type: application/json' \\
  -d '{"name": "Ada", "email": "ada@example.com"}'`}
          </pre>
          <span className="text-muted-foreground text-xs">
            Every step can then read the body, e.g.{" "}
            <code>{"{{trigger.body.email}}"}</code>. Only JSON, up to 256 KB.
          </span>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
