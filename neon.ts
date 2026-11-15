import { defineConfig } from "@neon/config/v1";

// screenshots: desktop screenshots from the agent. uploads: general file uploads.
// Provision with `neon link` then `neon deploy`.
export default defineConfig({
	// Managed Better Auth: users and sessions live in the neon_auth schema.
	auth: true,
	buckets: {
		screenshots: {},
		uploads: { access: "private" },
	},
});
