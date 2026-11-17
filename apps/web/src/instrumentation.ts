// Next.js instrumentation hook: starts Sentry on the server and reports errors from
// Server Components, route handlers and proxy.ts. No edge-runtime code in this app.
import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const production = process.env.NODE_ENV === "production";
		Sentry.init({
			dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, // unset: Sentry is off
			environment: production ? "production" : "development",
			tracesSampleRate: production ? 0.2 : 1,
			integrations: [
				Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
			],
		});
	}
}

export const onRequestError = Sentry.captureRequestError;
