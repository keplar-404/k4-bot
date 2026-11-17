import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import { withEve } from "eve/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	// No cacheComponents: its streamed <Suspense> boundaries hit Next.js #94750
	// (stuck `$~` reveal, page never hydrates) on ~1 in 8 chat loads in `next start`.
	reactCompiler: true,
	// The chat is the dashboard for now. A config redirect, not redirect() in a page:
	// that throws during the Cache Components prerender check.
	async redirects() {
		return [
			{
				source: "/dashboard",
				destination: "/dashboard/chat",
				permanent: false,
			},
		];
	},
	// Stops other sites from framing the app (clickjacking the approve buttons).
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				],
			},
		];
	},
	turbopack: {
		root: path.join(__dirname, "../.."),
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
				as: "*.css",
			},
		},
	},
};

// Proxies /eve/v1/* to the agent in apps/ai-agent. In dev it reuses a running
// `eve dev` for that agent or starts one. Sentry wraps outermost (Sentry docs:
// apply other wrappers first); it uploads source maps when SENTRY_AUTH_TOKEN is set.
export default withSentryConfig(
	withEve(nextConfig, { eveRoot: "../ai-agent" }),
	{
		org: "shehub",
		project: "k4-web",
		silent: !process.env.CI,
		// Browser events go to /monitoring on this site, which forwards them to Sentry:
		// ad blockers (Brave Shields) block requests to sentry.io directly.
		tunnelRoute: "/monitoring",
	},
);
