"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	// React 19 warns about the client-side copy of next-themes' inline script.
	// Server HTML keeps the runnable script (no flash); the client copy is a data block.
	// shortcut: workaround for pacocoursey/next-themes#385, drop when next-themes fixes it.
	const scriptProps =
		typeof window === "undefined"
			? undefined
			: ({ type: "application/json" } as const);

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			scriptProps={scriptProps}
		>
			{children}
		</NextThemesProvider>
	);
}
