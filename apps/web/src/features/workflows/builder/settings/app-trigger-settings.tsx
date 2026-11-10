"use client";

import { useEffect } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { appName } from "../block-label";
import type { BlockBody } from "../blocks";
import { AppConnection } from "./app-connection";
import { ChosenApp } from "./chosen-app";
import { EventChosen } from "./event-chosen";
import { EventPicker } from "./event-picker";
import { SettingsSection } from "./field";
import { SchemaFieldsList } from "./schema-fields-list";
import { SchemaForm } from "./schema-form";
import { fetchTrigger, type TriggerType, withoutDeprecated } from "./tools-api";
import { TriggerAppPicker } from "./trigger-app-picker";
import { useNoAuth } from "./use-no-auth";

type AppTriggerBlock = Extract<BlockBody, { kind: "trigger.app" }>;

/** An app event starts the workflow: which app, which account, which event, its settings, and what it sends. */
export function AppTriggerSettings({
  block,
  update,
}: {
  block: AppTriggerBlock;
  update: (b: AppTriggerBlock) => void;
}) {
  const { toolkit, trigger } = block.config;
  const noAuth = useNoAuth(toolkit ?? "");
  const [{ type, error }, , store] = useLocalStore(() => ({
    type: null as TriggerType | null,
    error: null as string | null,
  }));
  const setType = fieldSetter(store, "type");
  const setError = fieldSetter(store, "error");
  const setConfig = (config: AppTriggerBlock["config"]) =>
    update({ ...block, config });

  useEffect(() => {
    setType(null);
    setError(null);
    if (trigger)
      fetchTrigger(trigger).then(setType, (e: Error) => setError(e.message));
  }, [trigger, setError, setType]);

  if (!toolkit) {
    return (
      <SettingsSection title="App">
        <TriggerAppPicker
          onPick={(slug) => setConfig({ toolkit: slug, config: {} })}
        />
      </SettingsSection>
    );
  }
  const name = appName(toolkit);
  return (
    <>
      <SettingsSection title="App">
        <ChosenApp
          toolkit={toolkit}
          onChange={() => setConfig({ config: {} })}
        />
      </SettingsSection>
      {!noAuth && (
        <SettingsSection title="Account">
          <AppConnection toolkit={toolkit} appName={name} />
        </SettingsSection>
      )}
      <SettingsSection title="Runs when">
        {!trigger ? (
          <EventPicker
            toolkit={toolkit}
            onPick={(t) => setConfig({ toolkit, trigger: t.slug, config: {} })}
          />
        ) : (
          <EventChosen
            type={type}
            trigger={trigger}
            onChange={() => setConfig({ toolkit, config: {} })}
          />
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </SettingsSection>
      {type && (
        <>
          <SettingsSection title="Only when">
            <SchemaForm
              schema={withoutDeprecated(type.config)}
              value={block.config.config}
              onChange={(config) => setConfig({ ...block.config, config })}
              emptyText="This event has no settings: every one of them starts the workflow."
            />
          </SettingsSection>
          <SettingsSection title="It sends">
            <SchemaFieldsList schema={type.payload} prefix="trigger.data" />
          </SettingsSection>
        </>
      )}
    </>
  );
}
