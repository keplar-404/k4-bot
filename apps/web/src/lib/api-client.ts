import type { AppType } from "@backend/index";
import { hc } from "hono/client";

const baseUrl = (process.env.NEXT_PUBLIC_AUTH_URL ??
  "http://localhost:8787") as string;

export const api = hc<AppType>(baseUrl);
export type ApiClient = typeof api;

export type { AppType };
