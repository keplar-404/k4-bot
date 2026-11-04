"use client";

/**
 * AI Elements "Web Preview" (https://elements.ai-sdk.dev/components/web-preview), adapted to this project's Base UI
 * primitives: triggers take `render` instead of Radix's `asChild`. The console part is left out (nothing feeds it).
 * WebPreviewBody's props are spread after its defaults, so a caller can set or drop the `sandbox` attribute.
 */
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Ctx = { url: string; setUrl: (url: string) => void };
const WebPreviewContext = createContext<Ctx | null>(null);

const useWebPreview = () => {
  const ctx = useContext(WebPreviewContext);
  if (!ctx) throw new Error("WebPreview components must be used within a WebPreview");
  return ctx;
};

export type WebPreviewProps = ComponentProps<"div"> & { url: string; onUrlChange: (url: string) => void };

/** Controlled: the caller owns the URL (and so its history). */
export const WebPreview = ({ className, children, url, onUrlChange, ...props }: WebPreviewProps) => (
  <WebPreviewContext.Provider value={{ url, setUrl: onUrlChange }}>
    <div className={cn("flex size-full flex-col bg-card", className)} {...props}>
      {children}
    </div>
  </WebPreviewContext.Provider>
);

export const WebPreviewNavigation = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex items-center gap-1 border-b p-2", className)} {...props} />
);

export const WebPreviewNavigationButton = ({ tooltip, children, ...props }: ComponentProps<typeof Button> & { tooltip: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger render={<Button className="size-8 p-0 hover:text-foreground" size="sm" variant="ghost" aria-label={tooltip} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** The address bar: edits stay local until Enter, which hands the text to the caller. */
export const WebPreviewUrl = (props: ComponentProps<typeof Input>) => {
  const { url, setUrl } = useWebPreview();
  const [text, setText] = useState(url);
  useEffect(() => setText(url), [url]);
  return (
    <Input
      className="h-8 flex-1 text-sm"
      placeholder="Enter a URL…"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && setUrl(text)}
      aria-label="Address"
      {...props}
    />
  );
};

export const WebPreviewBody = ({ className, loading, src, ...props }: ComponentProps<"iframe"> & { loading?: ReactNode }) => {
  const { url } = useWebPreview();
  return (
    <div className="relative min-h-0 flex-1">
      <iframe
        className={cn("size-full border-0", className)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        src={(src ?? url) || undefined}
        title="Preview"
        {...props}
      />
      {loading}
    </div>
  );
};
