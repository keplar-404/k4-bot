import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import { cn } from "@/lib/utils";
import type { GroupMember } from "./api";

/** A group's picture: its first bots' avatars overlapping, with "+N" for the rest. */
export function AvatarStack({
  members,
  size = 20,
  max = 3,
  className,
}: {
  members: GroupMember[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {shown.map((m, i) => (
        // The avatar's drawing has its own padding: a light overlap, no background, so each one stays whole.
        <span
          key={m.id}
          className="flex shrink-0"
          style={{ marginLeft: i === 0 ? 0 : -size / 4 }}
        >
          <BloubAvatar
            size={size}
            shape={m.shape}
            color={m.color}
            expression={m.expression}
          />
        </span>
      ))}
      {rest > 0 && (
        <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
          +{rest}
          <span className="sr-only"> more bots</span>
        </span>
      )}
    </span>
  );
}
