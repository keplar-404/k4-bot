"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRunView } from "../../live/run-view-store";
import type { BlockBody } from "../blocks";
import { usePanels } from "../panels-store";
import { BlockOptions, hasOptions } from "./block-options";
import { BlockSettings } from "./block-settings";
import { DataReferences } from "./data-references";
import { SettingsSection } from "./field";
import { OutputPane } from "./output-pane";

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
    ["run", "Test"],
    ...(hasOptions(block) ? [["options", "Options"] as [Tab, string]] : []),
  ];
  const [tab, setTab] = useState<Tab>("setup");
  // A run that appears (a test run, a failure being shown) opens its tab; another block keeps the tab if it has it.
  useEffect(() => setTab(runShown ? "run" : "setup"), [runShown]);
  const current = tabs.some(([t]) => t === tab) ? tab : "setup";
  const wide = usePanels((s) => s.wide);
  const warning = issue && (
    <output className="mx-4 mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
      <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
      {issue}
    </output>
  );

  return (
    <>
      {/* Widened on a wide screen: input, settings and output side by side (n8n's node view). */}
      {wide && (
        <div className="hidden min-h-0 flex-1 grid-cols-[1fr_1.3fr_1fr] divide-x xl:grid">
          <div className="min-h-0 overflow-y-auto">
            <SettingsSection
              title={isTrigger ? "Input" : "Input: data from earlier steps"}
            >
              {isTrigger ? (
                <p className="text-muted-foreground text-xs">
                  A trigger starts the run; it has no earlier steps.
                </p>
              ) : (
                <DataReferences id={block.id} />
              )}
            </SettingsSection>
          </div>
          <div className="min-h-0 overflow-y-auto">
            {warning}
            <BlockSettings block={block} update={update} />
            {hasOptions(block) && (
              <BlockOptions block={block} update={update} />
            )}
          </div>
          <div className="min-h-0 overflow-y-auto">
            <SettingsSection title="Output">
              <OutputPane blockId={block.id} />
            </SettingsSection>
          </div>
        </div>
      )}
      <Tabs
        value={current}
        onValueChange={(v) => setTab(v as Tab)}
        className={`min-h-0 flex-1 gap-0 ${wide ? "xl:hidden" : ""}`}
      >
        <TabsList variant="line" className="w-full justify-start border-b px-2">
          {tabs.map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="flex-none px-2.5">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {warning}
          <TabsContent value="setup">
            <BlockSettings block={block} update={update} />
          </TabsContent>
          <TabsContent value="data">
            <SettingsSection title="Data from earlier steps">
              <DataReferences id={block.id} />
            </SettingsSection>
          </TabsContent>
          <TabsContent value="run">
            <SettingsSection title="Output">
              <OutputPane blockId={block.id} />
            </SettingsSection>
          </TabsContent>
          {hasOptions(block) && (
            <TabsContent value="options">
              <BlockOptions block={block} update={update} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </>
  );
}
