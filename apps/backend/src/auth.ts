import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const isDev = process.env.NODE_ENV !== "production";

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
	// dev: any localhost port; prod: only WEB_URL
	trustedOrigins: isDev
		? [webUrl, "http://localhost:*", "http://127.0.0.1:*"]
		: [webUrl],
	rateLimit: {
		storage: "database", // memory is not shared across serverless instances
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 3 },
		},
	},
	database: drizzleAdapter(db, { provider: "pg" }),
	emailAndPassword: { enabled: true },
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
});
