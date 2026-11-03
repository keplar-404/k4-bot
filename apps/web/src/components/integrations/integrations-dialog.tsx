"use client";

import { PlugIcon, PuzzleIcon } from "lucide-react";
import { McpTab } from "@/components/integrations/mcp-tab";
import { SkillsTab } from "@/components/integrations/skills-tab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type IntegrationsTab,
  useIntegrationsDialog,
} from "@/lib/integrations";

/** Skills and MCP servers, opened from the sidebar's Platform group. Mounted once, in the sidebar. */
export function IntegrationsDialog() {
  const { open, tab, setOpen, setTab } = useIntegrationsDialog();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[min(720px,90dvh)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-4 p-5 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Skills &amp; MCP servers</DialogTitle>
          <DialogDescription>
            Install skills and connect apps here, then choose which ones each
            bot uses in its settings.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as IntegrationsTab)}
          className="min-h-0 flex-1"
        >
          <TabsList>
            <TabsTrigger value="skills">
              <PuzzleIcon />
              Skills
            </TabsTrigger>
            <TabsTrigger value="mcp">
              <PlugIcon />
              MCP servers
            </TabsTrigger>
          </TabsList>
          {/* Each panel scrolls on its own, so the tabs stay in view. */}
          <TabsContent
            value="skills"
            className="-mr-2 min-h-0 overflow-y-auto pr-2"
          >
            <SkillsTab />
          </TabsContent>
          <TabsContent
            value="mcp"
            className="-mr-2 min-h-0 overflow-y-auto pr-2"
          >
            <McpTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
