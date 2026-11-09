import type { Env } from "../../../../config/env";
import { allow } from "../../../../middleware/rate-limit";
import type { WorkflowNode } from "../../graph/schema";
import { FatalBlockError } from "../errors";
import { checkOutboundUrl, deniedHeader } from "../http-guard";
import { readResponse } from "./http-response";

export type HttpConfig = Extract<WorkflowNode, { kind: "action.http" }>["config"];

const MAX_REDIRECTS = 3;
const CONTENT_TYPES = { json: "application/json", form: "application/x-www-form-urlencoded" } as const;
/** Headers that must not follow a redirect to another site. */
const CREDENTIAL_HEADERS = ["authorization", "x-api-key", "cookie"];

/**
 * One request of the HTTP block (pagination in http-pages.ts makes several). Its fields are already filled in (templates and secrets). Every hop is checked by the
 * outbound URL guard, redirects are followed by hand, the response body is capped, and a 4xx fails at once
 * (except 408 and 429, which are worth a retry).
 */
export async function requestOnce(env: Env, userId: string, runId: string, config: HttpConfig, startUrl: string) {
  if (!(await allow(env, "RL_HTTP", userId))) {
    throw new Error("Slow down: the HTTP request limit was reached.");
  }

  const headers = buildHeaders(config, runId);
  const credentialHeaders = [...CREDENTIAL_HEADERS, config.auth.headerName.toLowerCase()];
  let body = buildBody(config, headers);
  let method: string = config.method;
  let url = startUrl;

  for (let redirects = 0; ; redirects++) {
    const refused = checkOutboundUrl(url, env);
    if (refused) throw new FatalBlockError(refused);

    const res = await fetch(url, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(config.timeoutSeconds * 1000),
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) throw new FatalBlockError("Too many redirects.");
      const next = new URL(location, url);
      if (next.origin !== new URL(url).origin) {
        for (const name of credentialHeaders) headers.delete(name);
      }
      // 307 and 308 keep the method and body; every other redirect becomes a plain GET.
      if (res.status !== 307 && res.status !== 308) {
        method = "GET";
        body = undefined;
      }
      url = next.toString();
      continue;
    }

    checkStatus(res.status);
    return readResponse(res, config.expect);
  }
}

function buildHeaders(config: HttpConfig, runId: string) {
  const headers = new Headers();
  for (const { name, value } of config.headers) {
    if (deniedHeader(name)) throw new FatalBlockError(`The header ${name} cannot be set.`);
    headers.set(name, value);
  }
  const { auth } = config;
  if (auth.type !== "none" && !auth.token) throw new FatalBlockError("The sign-in token is empty. Choose a secret for it.");
  if (auth.type === "bearer") headers.set("authorization", `Bearer ${auth.token}`);
  if (auth.type === "basic") headers.set("authorization", `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${auth.username}:${auth.token}`)))}`);
  if (auth.type === "api_key") {
    if (deniedHeader(auth.headerName)) throw new FatalBlockError(`The header ${auth.headerName} cannot be set.`);
    headers.set(auth.headerName, auth.token);
  }
  headers.set("user-agent", "k4-workflows/1.0");
  // Lets our own webhook route refuse a workflow that calls itself (routes/hooks.ts).
  headers.set("x-k4-workflow-run", runId);
  return headers;
}

/** The URL with the query parameters added (encoded); a URL that does not parse is left for the guard to refuse. */
export function withQuery(url: string, query: Array<{ name: string; value: string }>) {
  if (query.length === 0) return url;
  try {
    const u = new URL(url);
    for (const { name, value } of query) u.searchParams.append(name, value);
    return u.toString();
  } catch {
    return url;
  }
}

function buildBody(config: HttpConfig, headers: Headers): string | undefined {
  const { type, value } = config.body;
  if (config.method === "GET" || type === "none") return undefined;

  if (type === "json") {
    try {
      JSON.parse(value);
    } catch {
      throw new FatalBlockError("The JSON body is not valid JSON.");
    }
  }
  if (type !== "text" && !headers.has("content-type")) headers.set("content-type", CONTENT_TYPES[type]);
  return value;
}

function checkStatus(status: number) {
  if (status < 400) return;
  const message = `The server answered ${status}.`;
  if (status < 500 && status !== 408 && status !== 429) throw new FatalBlockError(message);
  throw new Error(message);
}
