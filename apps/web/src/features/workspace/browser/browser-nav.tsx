"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  RotateCwIcon,
  ShieldIcon,
  ShieldOffIcon,
} from "lucide-react";
import {
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import type { useBrowserHistory } from "./use-browser-history";

/** The browser's toolbar: Back, Forward, Reload, the address bar, the sandbox switch and Open in a new tab. */
export function BrowserNav({
  history,
  sandboxed,
  onToggleSandbox,
}: {
  history: ReturnType<typeof useBrowserHistory>;
  sandboxed: boolean;
  onToggleSandbox: () => void;
}) {
  const current = history.url;
  return (
    <WebPreviewNavigation>
      <WebPreviewNavigationButton
        tooltip="Back"
        disabled={!history.canBack}
        onClick={history.back}
      >
        <ArrowLeftIcon />
      </WebPreviewNavigationButton>
      <WebPreviewNavigationButton
        tooltip="Forward"
        disabled={!history.canForward}
        onClick={history.forward}
      >
        <ArrowRightIcon />
      </WebPreviewNavigationButton>
      <WebPreviewNavigationButton
        tooltip="Reload"
        disabled={!current}
        onClick={history.reload}
      >
        <RotateCwIcon />
      </WebPreviewNavigationButton>
      <WebPreviewUrl />
      <WebPreviewNavigationButton
        tooltip={
          sandboxed
            ? "Turn the sandbox off for this page"
            : "Turn the sandbox back on"
        }
        disabled={!current}
        onClick={onToggleSandbox}
      >
        {sandboxed ? (
          <ShieldIcon />
        ) : (
          <ShieldOffIcon className="text-amber-500" />
        )}
      </WebPreviewNavigationButton>
      <WebPreviewNavigationButton
        tooltip="Open in a new browser tab"
        disabled={!current}
        onClick={() => window.open(current, "_blank", "noopener,noreferrer")}
      >
        <ExternalLinkIcon />
      </WebPreviewNavigationButton>
    </WebPreviewNavigation>
  );
}
