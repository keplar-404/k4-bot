"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowBuilder } from "@/features/workflows/builder/workflow-builder";

/** `useParams()` is runtime-only data: with Cache Components it must sit inside Suspense, or the build fails. */
function Builder() {
  const { id } = useParams<{ id: string }>();
  return <WorkflowBuilder key={id} id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-[calc(100svh-2rem)]" />}>
      <Builder />
    </Suspense>
  );
}
