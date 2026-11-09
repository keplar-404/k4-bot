import { inArray } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { composioToolkit } from "../../db/schema";
import type { WorkflowGraph } from "../workflows/graph/schema";
import { composioFor } from "./client";
import { listConnections } from "./connections";

export type NeededApp = { toolkit: string; name: string; logo: string | null };

/** Every app a workflow uses: its app-event trigger and its app actions. */
export function toolkitsOf(graph: WorkflowGraph): string[] {
  const used = graph.nodes.flatMap((n) =>
    (n.kind === "action.app" || n.kind === "trigger.app") && n.config.toolkit ? [n.config.toolkit] : [],
  );
  return [...new Set(used)];
}

/**
 * The apps in `toolkits` the user still has to connect: no ACTIVE account, and the app needs a login. Names and logos
 * come from the catalog, so the chat can show a proper "connect these apps" card.
 */
export async function missingApps(env: Env, db: Db, userId: string, toolkits: string[]): Promise<NeededApp[]> {
  const wanted = [...new Set(toolkits)].slice(0, 20);
  if (wanted.length === 0) return [];
  const [connections, catalog] = await Promise.all([
    listConnections(composioFor(env), userId),
    db
      .select({ slug: composioToolkit.slug, name: composioToolkit.name, logo: composioToolkit.logo, noAuth: composioToolkit.noAuth })
      .from(composioToolkit)
      .where(inArray(composioToolkit.slug, wanted)),
  ]);
  const active = new Set(connections.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit));
  return wanted.flatMap((toolkit) => {
    const app = catalog.find((t) => t.slug === toolkit);
    // An app missing from the catalog is not a real app; one that needs no login has nothing to connect.
    if (!app || app.noAuth || active.has(toolkit)) return [];
    return [{ toolkit, name: app.name, logo: app.logo }];
  });
}
