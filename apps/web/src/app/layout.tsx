import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Agentation } from "agentation";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
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
				geistSans.variable,
				geistMono.variable,
				"font-sans",
				inter.variable,
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
