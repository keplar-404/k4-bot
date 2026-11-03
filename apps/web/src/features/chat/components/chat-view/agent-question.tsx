"use client";

import {
  MessageCircleQuestionIcon,
  SendHorizontalIcon,
  ShieldQuestionIcon,
} from "lucide-react";
import { useState } from "react";
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

/** The agent asked something (a login, a code, a decision) and is waiting, possibly for days. */
export function AgentQuestion({
  question,
  kind,
  onAnswer,
}: {
  question: string;
  kind: string;
  onAnswer: (text: string) => void;
}) {
  const [text, setText] = useState("");
  if (kind === "confirm") {
    // A yes/no the bot needs before it does something that stops other work (e.g. turning the computer off).
    return (
      <Item variant="outline" size="sm" role="alert">
        <ItemMedia variant="icon">
          <ShieldQuestionIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="whitespace-normal">{question}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline" onClick={() => onAnswer("no")}>
            Keep it on
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onAnswer("yes")}
          >
            Turn off anyway
          </Button>
        </ItemActions>
      </Item>
    );
  }
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <MessageCircleQuestionIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="whitespace-normal">{question}</ItemTitle>
        {kind !== "info" && (
          <ItemDescription>
            Open the computer on the right if you need to do it yourself, then
            answer here.
          </ItemDescription>
        )}
      </ItemContent>
      <ItemActions className="w-full sm:w-auto">
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAnswer(text);
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer"
            aria-label="Your answer"
            className="min-w-0 sm:w-64"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim()}
            aria-label="Send answer"
          >
            <SendHorizontalIcon />
          </Button>
        </form>
      </ItemActions>
    </Item>
  );
}
