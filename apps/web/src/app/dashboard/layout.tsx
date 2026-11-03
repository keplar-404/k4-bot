import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AuthGuard />
      {/* Sidebar reads usePathname (runtime data) — Suspense keeps the shell prerenderable */}
      <Suspense fallback={<Skeleton className="h-dvh w-56" />}>
        <AppSidebar />
      </Suspense>
      {/* min-w-0: a long unbreakable line in a page (a wide code block) must not widen the page past the
          window and push the computer side bar off screen. */}
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
