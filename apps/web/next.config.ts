import path from "node:path";
import { withEve } from "eve/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	cacheComponents: true,
	partialPrefetching: true,
	reactCompiler: true,
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
// `eve dev` for that agent or starts one.
export default withEve(nextConfig, { eveRoot: "../ai-agent" });
