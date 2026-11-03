import { ExternalLinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogMcp } from "@/features/integrations/api";

/** One password input per secret the app needs, with how to get it. */
export function TokenFields({
  server,
  values,
  onChange,
}: {
  server: CatalogMcp;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {server.fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`mcp-${server.id}-${f.key}`}>{f.label}</Label>
          <Input
            id={`mcp-${server.id}-${f.key}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={f.placeholder}
            value={values[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {f.help}{" "}
            {f.helpUrl && (
              <a
                href={f.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                Create one
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </p>
        </div>
      ))}
    </>
  );
}
