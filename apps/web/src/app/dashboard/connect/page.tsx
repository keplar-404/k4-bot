"use client";

import { memo, useMemo, useState } from "react";
import { PlugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { platforms } from "./platforms";

const PAGE_SIZE = 30;

type PlatformItem = (typeof platforms)[number];

const PlatformCard = memo(function PlatformCard({
  platform,
}: {
  platform: PlatformItem;
}) {
  return (
    <Card
      size="sm"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 96px" }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-(--card-spacing)">
        <div className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
          <PlugIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium leading-tight">{platform.name}</p>
          <p className="text-sm text-muted-foreground">{platform.slug}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0">
          Connect
        </Button>
      </div>
    </Card>
  );
});

export default function ConnectPage() {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return platforms.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.includes(q)) return false;
      return true;
    });
  }, [query]);

  const displayed = filtered.slice(0, visible);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Connect</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Connect your accounts to let your bots use these platforms. {platforms.length}+
          integrations available via Composio. Each connection is scoped to you
          and can be revoked at any time.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search apps..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="sm:max-w-xs"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length} results
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((platform) => (
          <PlatformCard key={platform.name + platform.slug} platform={platform} />
        ))}
      </div>

      {visible < filtered.length && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        >
          Load more ({filtered.length - visible} remaining)
        </Button>
      )}
    </div>
  );
}
