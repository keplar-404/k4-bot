"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { request } from "@/features/chat/lib/client/http";

/**
 * The bot asked for an API key or private value. It goes from this form straight to the secrets vault (encrypted on the
 * server), never through the chat or the bot: the bot is only told "saved" or "cancelled".
 */
export function SecretRequestItem({
  name,
  label,
  why,
  onDone,
}: {
  name: string;
  label: string;
  why?: string;
  onDone: (saved: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value || busy) return;
    setBusy(true);
    try {
      await request(`/api/v1/secrets/${name}`, {
        method: "PUT",
        body: JSON.stringify({ value, label }),
      });
      setValue("");
      onDone(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save the secret.",
      );
      setBusy(false);
    }
  }

  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <KeyRoundIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="whitespace-normal">
          The bot needs {label}
        </ItemTitle>
        <ItemDescription>
          {why ? `${why} ` : ""}It is saved encrypted as {name}; the bot never
          sees it.
        </ItemDescription>
      </ItemContent>
      <ItemActions className="w-full sm:w-auto">
        <Input
          type="password"
          autoComplete="new-password"
          aria-label={label}
          placeholder="Paste it here"
          value={value}
          maxLength={4096}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
        />
        <Button size="sm" disabled={!value || busy} onClick={() => void save()}>
          Save securely
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onDone(false)}
        >
          Cancel
        </Button>
      </ItemActions>
    </Item>
  );
}
