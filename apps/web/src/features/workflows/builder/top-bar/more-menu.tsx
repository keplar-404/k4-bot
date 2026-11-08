"use client";

import { KeyRoundIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBuilder } from "../store";
import { usePublish } from "../use-publish";
import { WebhookDialog } from "./webhook-dialog";

/** "More" menu: rotate the webhook URL. */
export function MoreMenu() {
  const w = useBuilder((s) => s.workflow);
  const pub = usePublish();
  if (!w) return null;
  const isWebhook = w.graph.nodes.some((n) => n.kind === "trigger.webhook");
  if (!isWebhook || !w.hasWebhook)
    return <WebhookDialog url={pub.revealed} onClose={pub.closeRevealed} />;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="More" />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => void pub.newWebhookUrl()}>
            <KeyRoundIcon />
            New webhook URL
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WebhookDialog url={pub.revealed} onClose={pub.closeRevealed} />
    </>
  );
}
