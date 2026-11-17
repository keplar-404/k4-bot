import { AppSidebar } from "@/components/app-sidebar";
import { ChatCacheOwner } from "@/components/chat/chat-cache-owner";
import { DashboardShell } from "@/components/dashboard-shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getSession } from "@/lib/session";

// No <Suspense> here: a streamed boundary can stay hidden and unhydrated (Next.js #94750).
export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// proxy.ts already sends signed-out users to /login.
	const session = await getSession();
	return (
		<SidebarProvider>
			{session && <ChatCacheOwner userId={session.user.id} />}
			{session && <AppSidebar user={session.user} />}
			<SidebarInset className="min-w-0">
				<DashboardShell>{children}</DashboardShell>
			</SidebarInset>
		</SidebarProvider>
	);
}
