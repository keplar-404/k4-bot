import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectPage } from "@/features/connect/components/connect-page";

/** Suspense: the page reads the URL (?connected=) when the user comes back from Composio. */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-8 w-48" />}>
      <ConnectPage />
    </Suspense>
  );
}
