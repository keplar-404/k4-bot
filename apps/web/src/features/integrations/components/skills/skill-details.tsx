"use client";

import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CatalogSkill,
  getSkillDetails,
  type SkillDetails,
} from "@/features/integrations/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { InstallButton } from "./install-button";
import { publisher, RoleBadge } from "./role-badge";
import { SkillFiles } from "./skill-files";

/** SKILL.md without its frontmatter block (shown as the page header instead). */
const body = (md: string) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

/** A skill's page: who publishes it, its files, and the instructions the bot follows. */
export function SkillDetailsView({
  skill,
  onBack,
}: {
  skill: CatalogSkill;
  onBack: () => void;
}) {
  const [{ details, error }, , store] = useLocalStore(() => ({
    details: null as SkillDetails | null,
    error: null as string | null,
  }));
  const setDetails = fieldSetter(store, "details");
  const setError = fieldSetter(store, "error");
  useEffect(() => {
    let live = true;
    getSkillDetails(skill.id)
      .then((d) => live && setDetails(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [skill.id, setDetails, setError]);

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
          <SkillFiles files={details.files} />
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
