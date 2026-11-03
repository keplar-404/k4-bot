import { FileTextIcon } from "lucide-react";
import type { SkillDetails } from "@/features/integrations/api";

/** The files a skill brings (the first 30). */
export function SkillFiles({ files }: { files: SkillDetails["files"] }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Files ({files.length})
      </h4>
      <ul className="flex flex-wrap gap-1.5">
        {files.slice(0, 30).map((f) => (
          <li
            key={f.path}
            className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            <FileTextIcon className="size-3" />
            {f.path}
          </li>
        ))}
        {files.length > 30 && (
          <li className="px-1 text-xs text-muted-foreground">
            +{files.length - 30} more
          </li>
        )}
      </ul>
    </section>
  );
}
