"use client";

import { useEffect } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { appName } from "../block-label";
import type { BlockBody } from "../blocks";
import { ActionPicker } from "./action-picker";
import { AppActionChosen } from "./app-action-section";
import { AppConnection } from "./app-connection";
import { AppSettingsEmpty, AppSettingsLoading } from "./app-settings-empty";
import { SettingsSection } from "./field";
import { SchemaForm } from "./schema-form";
import { fetchTool, type ToolDetail } from "./tools-api";
import { useNoAuth } from "./use-no-auth";

type AppBlock = Extract<BlockBody, { kind: "action.app" }>;

/** An app step: its connection, which action it runs (version pinned when picked), that action's inputs, retries. */
export function AppSettings({
  block,
  update,
}: {
  block: AppBlock;
  update: (b: AppBlock) => void;
}) {
  const { toolkit, tool } = block.config;
  const noAuth = useNoAuth(toolkit ?? "");
  const [{ detail, picking, error }, , store] = useLocalStore(() => ({
    detail: null as ToolDetail | null,
    picking: !tool,
    error: null as string | null,
  }));
  const setDetail = fieldSetter(store, "detail");
  const setPicking = fieldSetter(store, "picking");
  const setError = fieldSetter(store, "error");

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (tool)
      fetchTool(tool).then(setDetail, (e: Error) => setError(e.message));
  }, [tool, setDetail, setError]);

  if (!toolkit) return <AppSettingsEmpty />;
  const name = appName(toolkit);
  return (
    <>
      {!noAuth && (
        <SettingsSection title="Account">
          <AppConnection toolkit={toolkit} appName={name} />
        </SettingsSection>
      )}
      <SettingsSection title="Action">
        {picking || !tool ? (
          <ActionPicker
            toolkit={toolkit}
            onPick={(t) => {
              update({
                ...block,
                config: {
                  ...block.config,
                  tool: t.slug,
                  version: t.version ?? undefined,
                  arguments: {},
                },
              });
              setPicking(false);
            }}
          />
        ) : (
          <AppActionChosen
            detail={detail}
            tool={tool}
            onChange={() => setPicking(true)}
          />
        )}
      </SettingsSection>
      {tool && !picking && (
        <SettingsSection title="Inputs">
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : detail ? (
            <SchemaForm
              schema={detail.input}
              value={block.config.arguments}
              onChange={(args) =>
                update({
                  ...block,
                  config: { ...block.config, arguments: args },
                })
              }
            />
          ) : (
            <AppSettingsLoading />
          )}
        </SettingsSection>
      )}
    </>
  );
}
