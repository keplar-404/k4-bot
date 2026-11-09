"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockLastRun } from "../../live/block-last-run";
import { useRunView } from "../../live/run-view-store";
import type { BlockBody } from "../blocks";
import { BlockOptions, hasOptions } from "./block-options";
import { BlockSettings } from "./block-settings";
import { DataReferences } from "./data-references";
import { SettingsSection } from "./field";

type Tab = "setup" | "data" | "run" | "options";

/**
 * The selected block's settings in tabs, each one thing: Setup (what the block does), Data (what it can read from
 * earlier steps), Run (what it did in the run shown on the canvas) and Options (retries, what happens on failure).
 */
export function SettingsTabs({
  block,
  update,
  issue,
}: {
  block: BlockBody;
  update: (b: BlockBody) => void;
  issue?: string;
}) {
  const runShown = useRunView((s) => s.detail !== null);
  const isTrigger = block.kind.startsWith("trigger.");
  const tabs: Array<[Tab, string]> = [
    ["setup", "Setup"],
    ...(!isTrigger ? [["data", "Data"] as [Tab, string]] : []),
    ["run", "Last run"],
    ...(hasOptions(block) ? [["options", "Options"] as [Tab, string]] : []),
  ];
  const [tab, setTab] = useState<Tab>("setup");
  // A run that appears (a test run, a failure being shown) opens its tab; another block keeps the tab if it has it.
  useEffect(() => setTab(runShown ? "run" : "setup"), [runShown]);
  const current = tabs.some(([t]) => t === tab) ? tab : "setup";

  return (
    <Tabs
      value={current}
      onValueChange={(v) => setTab(v as Tab)}
      className="min-h-0 flex-1 gap-0"
    >
      <TabsList variant="line" className="w-full justify-start border-b px-2">
        {tabs.map(([value, label]) => (
          <TabsTrigger key={value} value={value} className="flex-none px-2.5">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {issue && (
          <output className="mx-4 mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            {issue}
          </output>
        )}
        <TabsContent value="setup">
          <BlockSettings block={block} update={update} />
        </TabsContent>
        <TabsContent value="data">
          <SettingsSection title="Data from earlier steps">
            <DataReferences id={block.id} />
          </SettingsSection>
        </TabsContent>
        <TabsContent value="run">
          <SettingsSection title="In the run shown">
            {runShown ? (
              <BlockLastRun blockId={block.id} />
            ) : (
              <p className="text-muted-foreground text-xs">
                Run the workflow (or pick a run under Runs) to see what this
                block got and returned.
              </p>
            )}
          </SettingsSection>
        </TabsContent>
        {hasOptions(block) && (
          <TabsContent value="options">
            <BlockOptions block={block} update={update} />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
