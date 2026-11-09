"use client";

import type { BlockBody } from "../blocks";
import { AiSettings } from "./ai-settings";
import { AppSettings } from "./app-settings";
import { AppTriggerSettings } from "./app-trigger-settings";
import { ApprovalSettings } from "./approval-settings";
import { ConditionSettings } from "./condition-settings";
import { DecideSettings } from "./decide/decide-settings";
import { DelaySettings } from "./delay-settings";
import { CodeSettings } from "./code-settings";
import { FormatSettings } from "./format-settings";
import { HttpSettings } from "./http-settings";
import { ListSettings } from "./list-settings";
import { LoopSettings } from "./loop-settings";
import { MergeSettings } from "./merge-settings";
import { SetFieldsSettings } from "./set-fields-settings";
import { SwitchSettings } from "./switch-settings";
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
    case "trigger.app":
      return (
        <AppTriggerSettings key={block.id} block={block} update={update} />
      );
    case "action.app":
      return <AppSettings key={block.id} block={block} update={update} />;
    case "action.code":
      return <CodeSettings block={block} update={update} />;
    case "action.http":
      return <HttpSettings block={block} update={update} />;
    case "logic.if":
    case "logic.filter":
      return <ConditionSettings block={block} update={update} />;
    case "logic.delay":
      return <DelaySettings block={block} update={update} />;
    case "logic.set":
      return <SetFieldsSettings block={block} update={update} />;
    case "ai.bot":
      return <AiSettings block={block} update={update} />;
    case "ai.decide":
      return <DecideSettings block={block} update={update} />;
    case "logic.format":
      return <FormatSettings block={block} update={update} />;
    case "logic.merge":
      return <MergeSettings block={block} update={update} />;
    case "logic.list":
      return <ListSettings block={block} update={update} />;
    case "logic.switch":
      return <SwitchSettings block={block} update={update} />;
    case "logic.loop":
      return <LoopSettings block={block} update={update} />;
    case "logic.approval":
      return <ApprovalSettings block={block} update={update} />;
  }
}
