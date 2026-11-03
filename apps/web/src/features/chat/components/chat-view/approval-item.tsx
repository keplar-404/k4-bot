"use client";

import { ShieldQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { APPROVAL_LABEL } from "./approval-label";

export function ApprovalItem({
  actions,
  onApprove,
  onReject,
}: {
  actions: { name: string; args: Record<string, unknown> }[];
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <ShieldQuestionIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="break-all">
          {actions
            .map(
              (a) =>
                APPROVAL_LABEL[a.name] ??
                `Approve ${a.name}${a.args.file_path ? ` ${String(a.args.file_path)}` : ""}`,
            )
            .join(", ")}
          ?
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" onClick={() => void onReject()}>
          Reject
        </Button>
        <Button size="sm" onClick={() => void onApprove()}>
          Approve
        </Button>
      </ItemActions>
    </Item>
  );
}
