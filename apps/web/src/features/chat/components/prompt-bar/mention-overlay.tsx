import type { ReactNode } from "react";
import { GLYPHS, Icon } from "./icons";
import type { Mention } from "./prompt-state";

const COMMAND = /^\/(compact|deep-research)\b/;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The draft with its mentions ("@Gmail", "@Weekly report") and command ("/deep-research") highlighted. It sits under
 * the textarea, whose own text is transparent, so typing, the caret and selection stay the browser's own. Highlights
 * use no padding, so every character stays exactly where the textarea draws it.
 */
export function MentionOverlay({
  draft,
  mentions,
  className,
}: {
  draft: string;
  mentions: Mention[];
  className: string;
}) {
  const byName = new Map(mentions.map((m) => [m.name, m]));
  const names = [...byName.keys()]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const pattern = names.length
    ? new RegExp(`@(?:${names.join("|")})`, "g")
    : null;
  const parts: ReactNode[] = [];
  let rest = draft;
  const command = COMMAND.exec(rest);
  if (command) {
    parts.push(
      <mark
        key="cmd"
        className="rounded-[4px] bg-accent-ink/15 text-accent-ink"
      >
        {command[0]}
      </mark>,
    );
    rest = rest.slice(command[0].length);
  }
  let last = 0;
  for (const match of pattern ? rest.matchAll(pattern) : []) {
    const at = match.index ?? 0;
    parts.push(rest.slice(last, at));
    parts.push(
      <mark
        key={at}
        className="relative rounded-[4px] bg-accent-ink/15 font-medium text-accent-ink shadow-[0_0_0_2px] shadow-accent-ink/15"
      >
        <MentionMark mention={byName.get(match[0].slice(1))} />
        {match[0].slice(1)}
      </mark>,
    );
    last = at + match[0].length;
  }
  parts.push(rest.slice(last));
  return (
    <div
      aria-hidden
      className={`pointer-events-none whitespace-pre-wrap text-ink ${className}`}
    >
      {parts}
      {/* A trailing newline needs a character after it to take up its line, as the textarea's does. */}
      {"​"}
    </div>
  );
}

/**
 * The "@" of a mention, drawn as the app's logo (or the item's icon) on top of the invisible "@": it takes exactly the
 * "@"'s place, so no character after it moves.
 */
function MentionMark({ mention }: { mention?: Mention }) {
  const icon = mention?.logo ? (
    // biome-ignore lint/performance/noImgElement: a tiny third-party logo inside a text overlay; next/image adds nothing here
    <img src={mention.logo} alt="" className="size-full rounded-[3px] object-contain" />
  ) : mention?.glyph && GLYPHS[mention.glyph] ? (
    <Icon size={13}>{GLYPHS[mention.glyph]}</Icon>
  ) : null;
  if (!icon) return <>@</>;
  return (
    <span className="relative">
      <span className="text-transparent">@</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-[0.95em] items-center justify-center">{icon}</span>
      </span>
    </span>
  );
}
