"use client";

import { FileTextIcon } from "lucide-react";
import type { ToolPart } from "./util";
import { parse, str, type ToolDesc } from "./util";

export function describeFiles(part: ToolPart, done: boolean): ToolDesc | null {
  const a = parse(part.input);
  switch (part.name) {
    case "read_file":
    case "write_file":
    case "edit_file":
    case "ls":
    case "glob":
    case "grep": {
      const verb: Record<string, [string, string]> = {
        read_file: ["Read", "Reading"],
        write_file: ["Wrote", "Writing"],
        edit_file: ["Edited", "Editing"],
        ls: ["Listed", "Listing"],
        glob: ["Searched files", "Searching files"],
        grep: ["Searched files", "Searching files"],
      };
      const target = str(a.file_path ?? a.path ?? a.pattern, 60);
      return {
        icon: <FileTextIcon />,
        title: `${verb[part.name]![done ? 0 : 1]} ${target}`.trim(),
      };
    }
    default:
      return null;
  }
}
