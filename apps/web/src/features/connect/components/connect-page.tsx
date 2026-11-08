"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useCatalog } from "../use-catalog";
import { useCategories } from "../use-categories";
import { useConnectReturn } from "../use-connect-return";
import { useConnections } from "../use-connections";
import { AppListFooter } from "./app-list";
import { AppResults } from "./app-results";
import { ConnectIntro } from "./connect-intro";
import { ConnectToolbar, type StatusFilter } from "./connect-toolbar";
import { DisconnectDialog, type PendingDisconnect } from "./disconnect-dialog";

/**
 * Every Composio app (~1,700) the user can connect, as a searchable, filterable list. Connecting sends the user to
 * Composio's Connect Link and back; the account is theirs alone, and bots and workflows use it from then on.
 */
export function ConnectPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useCategories();
  const [pending, setPending] = useState<PendingDisconnect>(null);
  const conns = useConnections();
  const onlyConnected = status === "connected";
  const slugs = onlyConnected
    ? conns.ready
      ? conns.connectedSlugs
      : null
    : null;
  const catalog = useCatalog({ q: query, category, slugs });
  useConnectReturn(conns.reload);

  const error = catalog.error ?? conns.error;
  return (
    <>
      <PageHeader title="Connect" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-6">
        <ConnectIntro error={error} />
        <ConnectToolbar
          status={status}
          connectedCount={conns.connectedSlugs.length}
          onStatus={setStatus}
          query={query}
          onQuery={setQuery}
          category={category}
          categories={categories}
          onCategory={setCategory}
        />
        <AppResults
          items={catalog.items}
          loading={catalog.loading}
          query={query}
          onlyConnected={onlyConnected}
          filtered={Boolean(query || category)}
          stateOf={conns.stateOf}
          busySlug={conns.busy}
          onConnect={(slug) => void conns.connect(slug)}
          onDisconnect={(connection, appName) =>
            setPending({ connection, appName })
          }
          onClear={() => {
            setQuery("");
            setCategory(null);
          }}
          onShowAll={() => setStatus("all")}
        />
        <AppListFooter
          shown={catalog.items.length}
          total={catalog.total}
          loading={catalog.loading}
          onMore={catalog.loadMore}
        />
      </div>
      <DisconnectDialog
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending)
            void conns.disconnect(pending.connection, pending.appName);
          setPending(null);
        }}
      />
    </>
  );
}
