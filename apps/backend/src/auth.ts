import { createUserDesktop } from "@repo/shared/desktop";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { userDesktop } from "./db/app-schema";

export const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
export const isDev = process.env.NODE_ENV !== "production";

const google =
	process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
		? {
				google: {
					clientId: process.env.GOOGLE_CLIENT_ID,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET,
				},
			}
		: {};

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
	// dev: any localhost port; prod: only WEB_URL
	trustedOrigins: isDev
		? [webUrl, "http://localhost:*", "http://127.0.0.1:*"]
		: [webUrl],
	// Better Auth rate-limit docs: on in every environment (it is off in dev by
	// default), stored in the DB so all instances share counters.
	rateLimit: {
		enabled: true,
		storage: "database",
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 3 },
			"/get-session": false, // read on every page load and agent request
		},
	},
	advanced: {
		// Better Auth rate-limit docs: count per client IP. index.ts sets x-client-ip;
		// behind a proxy, list that proxy's header here instead.
		ipAddress: { ipAddressHeaders: ["x-client-ip"] }, // set in index.ts
	},
	database: drizzleAdapter(db, { provider: "pg" }),
	emailAndPassword: { enabled: true },
	socialProviders: google,
	databaseHooks: {
		user: {
			create: {
				// Every new user gets their own Linux desktop, created paused.
				after: async (user) => {
					try {
						const sandboxId = await createUserDesktop(user.id);
						await db.insert(userDesktop).values({ userId: user.id, sandboxId });
					} catch (error) {
						// Sign-up still succeeds; the agent creates the desktop on first use.
						console.error("desktop creation failed", user.id, error);
					}
				},
			},
		},
	},
});
