// Sentry in the browser (docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup).
import * as Sentry from "@sentry/nextjs";

// Same value as API_URL in lib/api.ts; not imported, so the auth client isn't
// set up before the app.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const production = process.env.NODE_ENV === "production";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, // unset: Sentry is off
	environment: production ? "production" : "development",
	// ponytail: 20% of production page loads fits the free plan; raise with budget.
	tracesSampleRate: production ? 0.2 : 1,
	// Send the trace headers to the backend too (it's another origin), so one trace
	// follows a click from the browser to the backend. /eve is same-origin already.
	tracePropagationTargets: [API_URL],
	// Replays only around errors: the free plan's replay quota is small.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1,
	integrations: [
		Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
	],
});

// Replay loads from Sentry's CDN after start (Sentry docs: APIs > lazyLoadIntegration),
// so it isn't in every page's first load. ponytail: errors in the first moments
// before it loads get no replay; import it eagerly again if those matter.
Sentry.lazyLoadIntegration("replayIntegration")
	.then((replay) => Sentry.addIntegration(replay()))
	.catch(() => {});

// Traces client-side navigations (sidebar chat switches).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
