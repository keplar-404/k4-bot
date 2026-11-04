"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ComputerPanel } from "@/features/computer/components/computer-panel";
import { BrowserTab } from "./browser/browser-tab";
import { CodeTab } from "./code/code-tab";
import { FilesTab } from "./files/files-tab";
import { FilePreview } from "./files/preview/file-preview";
import { useWorkspace } from "./use-workspace";
import { WorkspaceTabList } from "./workspace-tab-list";

/**
 * The tab strip and the shown tab, used by both the wide side bar and the narrow-screen sheet. Browser tabs stay
 * mounted (keepMounted) so their page is not reloaded when the user switches tabs and back.
 */
export function WorkspacePanels({ botId }: { botId: string }) {
  const { tabs, activeId, setActive } = useWorkspace();
  return (
    <Tabs
      value={activeId}
      onValueChange={(v) => setActive(String(v))}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <WorkspaceTabList />
      {tabs.map((t) => (
        <TabsContent
          key={t.id}
          value={t.id}
          keepMounted={t.kind === "browser"}
          className="min-h-0 flex-1 overflow-y-auto data-[hidden]:hidden"
        >
          {t.kind === "computer" && (
            <ComputerPanel botId={botId} className="flex-1" />
          )}
          {t.kind === "browser" && (
            <BrowserTab url={"url" in t ? t.url : undefined} />
          )}
          {t.kind === "files" && <FilesTab botId={botId} />}
          {t.kind === "code" && <CodeTab botId={botId} />}
          {t.kind === "file" && <FilePreview file={t.file} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}
