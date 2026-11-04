"use client";

import { useState } from "react";
import {
  WebPreview,
  WebPreviewBody,
} from "@/components/ai-elements/web-preview";
import { BrowserNav } from "./browser-nav";
import { normalizeUrl } from "./normalize-url";
import { useBrowserHistory } from "./use-browser-history";

/** As in DeepSeek Harness's web build: sandboxed by default, no referrer, no downloads or top-level navigation. */
const SANDBOX =
  "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/**
 * A small browser in the side bar (AI Elements Web Preview). Many sites refuse to be shown inside another app; for
 * those the toolbar opens the page in a real browser tab. The sandbox can be dropped for the current page only.
 */
export function BrowserTab({ url: initialUrl }: { url?: string }) {
  const history = useBrowserHistory(initialUrl ?? "");
  const [sandboxed, setSandboxed] = useState(true);
  const [error, setError] = useState("");
  const current = history.url;

  const navigate = (input: string) => {
    const { url, error } = normalizeUrl(input);
    setError(error ?? "");
    if (url) {
      setSandboxed(true);
      history.push(url);
    }
  };

  return (
    <WebPreview url={current} onUrlChange={navigate} className="h-full">
      <BrowserNav
        history={history}
        sandboxed={sandboxed}
        onToggleSandbox={() => setSandboxed((s) => !s)}
      />
      {error && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {!sandboxed && (
        <p className="bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Sandbox off: this page can navigate the app and open dialogs.
        </p>
      )}
      {current ? (
        <>
          <WebPreviewBody
            key={history.loadId}
            src={current}
            sandbox={sandboxed ? SANDBOX : undefined}
            referrerPolicy="no-referrer"
            title="Browser"
          />
          <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Page blank? Some sites refuse to open inside apps. Use “Open in a
            new browser tab”.
          </p>
        </>
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Type an address and press Enter.
        </p>
      )}
    </WebPreview>
  );
}
