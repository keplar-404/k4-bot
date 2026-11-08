import type { ReactNode } from "react";
import { AuthGuard } from "@/features/auth/components/auth-guard";

/** The workflow builder is full screen: no dashboard side bar, only the session check. */
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthGuard />
      {children}
    </>
  );
}
