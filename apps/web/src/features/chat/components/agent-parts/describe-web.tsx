"use client";

import { GlobeIcon, NetworkIcon, SearchIcon } from "lucide-react";
import type { ToolPart } from "./util";
import { hostOf, parse, str, type ToolDesc } from "./util";

export function describeWeb(part: ToolPart, done: boolean): ToolDesc | null {
  const a = parse(part.input);
  switch (part.name) {
    case "tavily_search":
      return {
        icon: <SearchIcon />,
        title: `${done ? "Searched" : "Searching"} "${str(a.query, 60)}"`,
      };
    case "tavily_extract": {
      const n = Array.isArray(a.urls) ? a.urls.length : 0;
      return {
        icon: <GlobeIcon />,
        title: `${done ? "Read" : "Reading"} ${n === 1 ? hostOf(a.urls) : `${n} pages`}`,
      };
    }
    case "tavily_map":
      return {
        icon: <NetworkIcon />,
        title: `${done ? "Mapped" : "Mapping"} ${hostOf(a.url)}`,
      };
    case "tavily_crawl":
      return {
        icon: <GlobeIcon />,
        title: `${done ? "Crawled" : "Crawling"} ${hostOf(a.url)}`,
      };
    default:
      return null;
  }
}
