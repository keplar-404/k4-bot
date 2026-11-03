import { DEFAULT_ROLE, type RoleId } from "../../lib/bot-roles";
import { advisor, assistant, coding, custom, writing } from "./general";
import { research } from "./research";
import type { DomainSpec } from "./types";

export type { DomainDefaults, DomainSpec } from "./types";

/** Every role's domain. A role without an entry falls back to the default role's domain. */
const DOMAINS: Record<RoleId, DomainSpec> = { assistant, advisor, coding, research, writing, custom };

export const domainFor = (role: string): DomainSpec => DOMAINS[role as RoleId] ?? DOMAINS[DEFAULT_ROLE];

/** What the web app needs to set up the bot form: defaults and suggestions per role (no prompts). */
export const publicDomains = () => Object.values(DOMAINS).map(({ id, web, defaults, recommended }) => ({ id, web, defaults, recommended }));
