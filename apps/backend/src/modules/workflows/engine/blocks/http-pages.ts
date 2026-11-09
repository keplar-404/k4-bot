import type { Env } from "../../../../config/env";
import { at } from "../list-ops";
import { type HttpConfig, requestOnce, withQuery } from "./http";

/**
 * The HTTP request block: one request, or with pagination several (each checked by the URL guard and the rate limit),
 * their items collected into `items`. The output is the last page's response plus `items` and `pages`.
 */
export async function runHttp(env: Env, userId: string, runId: string, config: HttpConfig) {
  const p = config.pagination;
  let url = withQuery(config.url, config.query);
  if (p.mode === "none") return requestOnce(env, userId, runId, config, url);

  const items: unknown[] = [];
  let last: Awaited<ReturnType<typeof requestOnce>> | undefined;
  let cursor: string | undefined;
  let pages = 0;
  while (pages < p.maxPages) {
    const page = p.mode === "page" ? String(p.start + pages) : cursor;
    const target = page === undefined ? url : withQuery(url, [{ name: p.param, value: page }]);
    last = await requestOnce(env, userId, runId, config, target);
    pages++;
    const got = p.itemsPath ? at(last.body, p.itemsPath) : last.body;
    if (Array.isArray(got)) items.push(...got);
    // A page without items ends it (and a page mode with no list to count would loop for nothing).
    if (!Array.isArray(got) || got.length === 0) break;
    if (p.mode === "page") continue;
    const next = at(last.body, p.nextPath);
    if (next === undefined || next === null || next === "") break;
    if (p.mode === "cursor") cursor = String(next);
    else url = new URL(String(next), target).toString();
  }
  return { ...last!, items, pages };
}
