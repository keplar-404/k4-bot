import {
  CompassIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  MonitorIcon,
  SquareTerminalIcon,
} from "lucide-react";
import type { WorkspaceTab } from "./types";

/** The icon of a tab, by what it shows. */
export function TabIcon({
  kind,
  className,
}: {
  kind: WorkspaceTab["kind"];
  className?: string;
}) {
  const Icon = {
    start: CompassIcon,
    computer: MonitorIcon,
    browser: GlobeIcon,
    files: FolderIcon,
    code: SquareTerminalIcon,
    file: FileIcon,
  }[kind];
  return <Icon className={className} />;
}
