import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* Sidebar reads usePathname (runtime data) — Suspense keeps the shell prerenderable */}
      <Suspense fallback={<Skeleton className="h-dvh w-56" />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
