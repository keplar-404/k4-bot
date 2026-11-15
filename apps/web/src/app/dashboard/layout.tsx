import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { EnsureDesktop } from "@/components/ensure-desktop";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getSession } from "@/lib/session";

// Reads the request cookie, so it renders inside <Suspense> (Cache Components).
async function UserSidebar() {
	// proxy.ts already sends signed-out users to /login.
	const session = await getSession();
	return session ? <AppSidebar user={session.user} /> : null;
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider>
			<EnsureDesktop />
			<Suspense>
				<UserSidebar />
			</Suspense>
			<SidebarInset className="min-w-0">
				<DashboardHeader />
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
