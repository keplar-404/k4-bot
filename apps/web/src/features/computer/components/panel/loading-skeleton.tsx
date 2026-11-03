import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Loading placeholder shown before the computer status resolves. */
export function PanelLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 p-4", className)}>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="aspect-[16/10] w-full rounded-xl" />
    </div>
  );
}
