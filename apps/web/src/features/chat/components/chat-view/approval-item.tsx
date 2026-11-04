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
import { approvalLabel } from "./approval-label";

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
          {actions.map(approvalLabel).join(", ")}?
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
