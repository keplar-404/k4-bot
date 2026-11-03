"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLES, roleLabel } from "@/lib/bot-roles";
import {
  type CatalogSkill,
  getSkillDetails,
  installSkill,
  type SkillDetails,
  type SkillRole,
  uninstallSkill,
  useIntegrations,
} from "@/lib/integrations";

const FILTERS = ROLES.filter((r) => r.id !== "custom");
const publisher = (id: string) => id.split("/")[0] ?? "";
/** SKILL.md without its frontmatter block (shown as the page header instead). */
const body = (md: string) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

function RoleBadge({ role }: { role: SkillRole | null }) {
  if (!role) return null;
  return (
    <Badge variant="secondary" className="shrink-0">
      {roleLabel(role)}
    </Badge>
  );
}

/** + to install, a check once installed, a spinner while it runs. */
function InstallButton({
  skill,
  size = "icon-sm",
}: {
  skill: CatalogSkill;
  size?: "icon-sm" | "sm";
}) {
  const [busy, setBusy] = useState(false);
  const installed = Boolean(skill.installedId);
  const install = async () => {
    setBusy(true);
    try {
      await installSkill(skill.id);
      toast.success(`Installed ${skill.name}`, {
        description: "Add it to a bot when you create or edit the bot.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (size === "sm")
    return (
      <Button
        size="sm"
        disabled={installed || busy}
        onClick={() => void install()}
      >
        {busy ? (
          <Loader2Icon className="animate-spin" />
        ) : installed ? (
          <CheckIcon />
        ) : (
          <PlusIcon />
        )}
        {installed ? "Installed" : busy ? "Installing…" : "Install"}
      </Button>
    );
  return (
    <Button
      size="icon-sm"
      variant={installed ? "ghost" : "outline"}
      disabled={installed || busy}
      aria-label={
        installed ? `${skill.name} is installed` : `Install ${skill.name}`
      }
      title={installed ? "Installed" : "Install"}
      onClick={(e) => {
        e.stopPropagation();
        void install();
      }}
    >
      {busy ? (
        <Loader2Icon className="animate-spin" />
      ) : installed ? (
        <CheckIcon />
      ) : (
        <PlusIcon />
      )}
    </Button>
  );
}

function SkillDetailsView({
  skill,
  onBack,
}: {
  skill: CatalogSkill;
  onBack: () => void;
}) {
  const [details, setDetails] = useState<SkillDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getSkillDetails(skill.id)
      .then((d) => live && setDetails(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [skill.id]);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeftIcon />
          All skills
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{skill.name}</h3>
            <RoleBadge role={skill.role} />
          </div>
          <p className="text-sm text-muted-foreground">
            by {publisher(skill.id)} ·{" "}
            <a
              href={`https://skills.sh/${skill.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              skills.sh
              <ExternalLinkIcon className="size-3" />
            </a>
          </p>
        </div>
        <InstallButton skill={skill} size="sm" />
      </header>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !details ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <p className="text-sm">{details.description}</p>
          <section className="space-y-2">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Files ({details.files.length})
            </h4>
            <ul className="flex flex-wrap gap-1.5">
              {details.files.slice(0, 30).map((f) => (
                <li
                  key={f.path}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <FileTextIcon className="size-3" />
                  {f.path}
                </li>
              ))}
              {details.files.length > 30 && (
                <li className="px-1 text-xs text-muted-foreground">
                  +{details.files.length - 30} more
                </li>
              )}
            </ul>
          </section>
          <section className="space-y-2">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Instructions the bot follows
            </h4>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <Markdown>{body(details.skillMd)}</Markdown>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Skills: curated per bot role. A card opens the skill's full details; + installs it for the user, and the bot
 * form then offers it.
 */
export function SkillsTab() {
  const { skills, error } = useIntegrations();
  const [filter, setFilter] = useState<SkillRole | "all">("all");
  const [selected, setSelected] = useState<CatalogSkill | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Keep the open details in sync with installs (the + on the details page updates the shared list).
  const current = selected
    ? (skills?.catalog.find((s) => s.id === selected.id) ?? selected)
    : null;
  if (current)
    return (
      <SkillDetailsView skill={current} onBack={() => setSelected(null)} />
    );

  if (error && !skills)
    return <p className="text-sm text-destructive">{error}</p>;
  if (!skills)
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );

  const shown =
    filter === "all"
      ? skills.catalog
      : skills.catalog.filter((s) => s.role === filter);

  const remove = async (id: string, name: string) => {
    setRemoving(id);
    try {
      await uninstallSkill(id);
      toast.success(`Removed ${name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Installed</h3>
        {skills.installed.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No skills yet. Install one below, then add it to a bot from the
            bot&apos;s settings.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {skills.installed.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.description}
                  </p>
                </div>
                <RoleBadge role={s.role} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${s.title}`}
                  title="Remove (also from your bots)"
                  disabled={removing === s.id}
                  onClick={() => void remove(s.id, s.title)}
                >
                  {removing === s.id ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <Trash2Icon />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Browse skills</h3>
          <div
            role="tablist"
            aria-label="Filter by role"
            className="flex flex-wrap gap-1"
          >
            {[{ id: "all" as const, label: "All" }, ...FILTERS].map((r) => (
              <Button
                key={r.id}
                role="tab"
                aria-selected={filter === r.id}
                size="xs"
                variant={filter === r.id ? "secondary" : "ghost"}
                onClick={() => setFilter(r.id as SkillRole | "all")}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {shown.map((s) => (
            <li key={s.id}>
              {/* biome-ignore lint/a11y/useSemanticElements: the card holds its own install button, so it cannot be a <button> */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelected(s)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(s);
                  }
                }}
                className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {filter === "all" && <RoleBadge role={s.role} />}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {s.summary}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {publisher(s.id)}
                  </p>
                </div>
                <InstallButton skill={s} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
