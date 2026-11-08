"use client";

import { Loader2Icon, PowerIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilder } from "../store";
import type { SaveState } from "../use-autosave";
import { usePublish } from "../use-publish";

/** Turn on / Publish changes / Turn off controls. */
export function PowerButtons({
  save,
}: {
  save: { state: SaveState; message: string | null };
}) {
  const w = useBuilder((s) => s.workflow);
  const pub = usePublish();
  if (!w) return null;
  const active = w.status === "active";
  const ready = w.issues.length === 0 && save.state === "saved";
  if (active && w.hasUnpublishedChanges) {
    return (
      <Button
        size="sm"
        disabled={pub.busy || !ready}
        onClick={() => void pub.publish()}
      >
        <UploadIcon />
        Publish changes
      </Button>
    );
  }
  if (active) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pub.busy}
        onClick={() => void pub.pause()}
      >
        {pub.busy ? <Loader2Icon className="animate-spin" /> : <PowerIcon />}
        Turn off
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      disabled={pub.busy || !ready}
      onClick={() => void pub.publish()}
    >
      {pub.busy ? <Loader2Icon className="animate-spin" /> : <PowerIcon />}
      Turn on
    </Button>
  );
}
