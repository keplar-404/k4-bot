"use client";

import type { Block, BlockBody } from "../blocks";
import { AppSettings } from "./app-settings";
import { ConditionSettings } from "./condition-settings";
import { DelaySettings } from "./delay-settings";
import { HttpSettings } from "./http-settings";
import { SetFieldsSettings } from "./set-fields-settings";
import { TriggerSettings } from "./trigger-settings";

type Props = {
  block: BlockBody;
  update: (b: BlockBody) => void;
};

/** The settings of one block, by kind. */
export function BlockSettings({ block, update }: Props) {
  switch (block.kind) {
    case "trigger.manual":
    case "trigger.schedule":
    case "trigger.webhook":
      return <TriggerSettings block={block} update={update} />;
    case "action.app":
      return <AppSettings key={block.id} block={block} update={update} />;
    case "action.http":
      return <HttpSettings block={block} update={update} />;
    case "logic.if":
    case "logic.filter":
      return <ConditionSettings block={block} update={update} />;
    case "logic.delay":
      return <DelaySettings block={block} update={update} />;
    case "logic.set":
      return <SetFieldsSettings block={block} update={update} />;
  }
}
