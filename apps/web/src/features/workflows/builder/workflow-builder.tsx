"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getWorkflow } from "../api";
import { RunBanner } from "../live/run-banner";
import { RunsDrawer } from "../live/runs-drawer";
import { useLiveRuns } from "../live/use-live-runs";
import { Canvas } from "./canvas";
import { LibraryPanel } from "./library/library-panel";
import { SettingsPanel } from "./settings/settings-panel";
import { useBuilder } from "./store";
import { RunButton } from "./top-bar/run-button";
import { ShareBotsDialog } from "./top-bar/share-bots-dialog";
import { TopBar } from "./top-bar/top-bar";
import { useAutosave } from "./use-autosave";

/**
 * The full-screen workflow builder: top bar, the canvas, the block library floating on the left and the selected
 * block's settings floating on the right (the layout of n8n / Zapier-style editors).
 */
export function WorkflowBuilder({ id }: { id: string }) {
  const load = useBuilder((s) => s.load);
  const loaded = useBuilder((s) => s.workflow?.id === id);
  const [error, setError] = useState<string | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const save = useAutosave();
  useLiveRuns(id);

  useEffect(() => {
    setError(null);
    getWorkflow(id).then(load, (e: Error) => setError(e.message));
  }, [id, load]);

  if (error) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">{error}</p>
        <Button variant="outline" render={<Link href="/dashboard/workflow" />}>
          Back to workflows
        </Button>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="flex h-svh items-center justify-center text-muted-foreground text-sm">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Opening workflow…
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <div className="flex h-svh flex-col bg-background">
        <TopBar save={save}>
          <ShareBotsDialog />
          <Button size="sm" variant="outline" onClick={() => setRunsOpen(true)}>
            Runs
          </Button>
          <RunButton save={save} />
        </TopBar>
        <main className="relative min-h-0 flex-1">
          <Canvas />
          <LibraryPanel />
          <SettingsPanel />
          <RunBanner />
        </main>
      </div>
      <RunsDrawer open={runsOpen} onOpenChange={setRunsOpen} />
    </ReactFlowProvider>
  );
}
