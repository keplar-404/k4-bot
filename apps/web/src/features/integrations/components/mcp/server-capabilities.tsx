import { CheckIcon } from "lucide-react";
import { roleLabel } from "@/features/bots/roles";
import type { CatalogMcp } from "@/features/integrations/api";

/** What bots can do with the app, and which roles it suits. */
export function ServerCapabilities({ server }: { server: CatalogMcp }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        What your bots can do
      </h4>
      <ul className="space-y-1 text-sm">
        {server.capabilities.map((c) => (
          <li key={c} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {c}
          </li>
        ))}
      </ul>
      {server.roles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Suits {server.roles.map((r) => roleLabel(r)).join(", ")} bots.
        </p>
      )}
    </section>
  );
}
