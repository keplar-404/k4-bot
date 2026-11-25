import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Agentation } from "agentation";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// globals.css maps these to font-sans / font-mono; font-serif is the system Georgia.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
	title: "K4",
	description: "K4, an AI assistant with its own computer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			suppressHydrationWarning
			lang="en"
			className={cn(
				"h-full",
				"antialiased",
				"font-sans",
				inter.variable,
				mono.variable,
			)}
		>
			<body className="min-h-full flex flex-col" suppressHydrationWarning>
				<ThemeProvider>
					{children}
					<Toaster />
					{process.env.NODE_ENV === "development" && <Agentation />}
				</ThemeProvider>
			</body>
		</html>
	);
}
