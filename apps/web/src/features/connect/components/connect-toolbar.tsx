"use client";

import { SearchIcon, XIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "../api";
import { categoryLabel } from "../category-label";
import {
  type StatusFilter,
  StatusFilter as StatusFilterComponent,
} from "./status-filter";
export type { StatusFilter };

const ALL = "__all__";

type Props = {
  status: StatusFilter;
  connectedCount: number;
  onStatus: (s: StatusFilter) => void;
  query: string;
  onQuery: (q: string) => void;
  category: string | null;
  categories: Category[];
  onCategory: (slug: string | null) => void;
};

/** All / Connected, a search box, and the category filter (categories come from the apps themselves). */
export function ConnectToolbar(p: Props) {
  const label = p.categories.find((c) => c.slug === p.category)?.name;
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <StatusFilterComponent
        status={p.status}
        connectedCount={p.connectedCount}
        onStatus={p.onStatus}
      />
      <InputGroup className="lg:max-w-md lg:flex-1">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={p.query}
          onChange={(e) => p.onQuery(e.target.value)}
          placeholder="Search apps, e.g. Gmail, Slack, Notion"
          aria-label="Search apps"
          maxLength={80}
        />
        {p.query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => p.onQuery("")}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <Select
        value={p.category ?? ALL}
        onValueChange={(v) => p.onCategory(v === ALL || !v ? null : String(v))}
      >
        <SelectTrigger
          className="w-full lg:ml-auto lg:w-60"
          aria-label="Category"
        >
          <SelectValue>
            {label ? categoryLabel(label) : "All categories"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ALL}>All categories</SelectItem>
          {p.categories.map((c) => (
            <SelectItem key={c.slug} value={c.slug}>
              <span className="flex-1 truncate">{categoryLabel(c.name)}</span>
              <span className="ml-3 text-muted-foreground text-xs tabular-nums">
                {c.count}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
