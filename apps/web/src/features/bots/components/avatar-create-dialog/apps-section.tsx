"use client";

import { PlugZapIcon } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { AppLogo } from "@/features/connect/components/app-logo";
import { useConnections } from "@/features/connect/use-connections";
import type { BotForm } from "./use-bot-form";

const nice = (slug: string) =>
  slug.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * The apps the user connected on the Connect page (Gmail, Slack, ...) that this bot may use. Each can be read-only. The
 * server checks again that the connection is the user's and active: this list only offers choices.
 */
export function AppsSection({ form }: { form: BotForm }) {
  const { ready, error, connectedSlugs, stateOf } = useConnections();
  const active = connectedSlugs.filter((s) => stateOf(s).kind === "active");
  const picked = form.composioToolkits;
  const toggle = (slug: string) =>
    form.setComposioToolkits(
      picked.includes(slug)
        ? picked.filter((s) => s !== slug)
        : [...picked, slug],
    );
  // An app the bot has but the user later disconnected stays visible, so it can be removed.
  const slugs = [...new Set([...active, ...picked])];

  return (
    <fieldset className="w-full space-y-2">
      <legend className="flex w-full items-center justify-between text-sm font-medium">
        <span className="flex items-center gap-1.5">
          <PlugZapIcon className="size-4" />
          Apps
        </span>
        <Link
          href="/dashboard/connect"
          className="text-muted-foreground text-xs underline"
        >
          Connect more apps
        </Link>
      </legend>
      {error ? (
        <p className="text-muted-foreground text-xs">
          Connected apps are not available right now.
        </p>
      ) : !ready ? (
        <p className="text-muted-foreground text-xs">Loading your apps…</p>
      ) : slugs.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No apps connected yet. Connect Gmail, Slack and more, then give them
          to this bot.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {slugs.map((slug) => {
            const on = picked.includes(slug);
            const dead = stateOf(slug).kind !== "active";
            return (
              <li
                key={slug}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(slug)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <AppLogo
                    src={`https://logos.composio.dev/api/${slug}`}
                    name={nice(slug)}
                    size="sm"
                  />
                  <span className="truncate text-sm">{nice(slug)}</span>
                  {dead && (
                    <span className="text-destructive text-xs">
                      not connected
                    </span>
                  )}
                </button>
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  Can change things
                  <Switch
                    aria-label={`${nice(slug)}: can change things`}
                    size="sm"
                    disabled={!on}
                    checked={on && (form.composioAllowWrites[slug] ?? true)}
                    onCheckedChange={(v) =>
                      form.setComposioAllowWrites({
                        ...form.composioAllowWrites,
                        [slug]: v,
                      })
                    }
                  />
                </span>
                <input
                  type="checkbox"
                  aria-label={`Let this bot use ${nice(slug)}`}
                  checked={on}
                  onChange={() => toggle(slug)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
