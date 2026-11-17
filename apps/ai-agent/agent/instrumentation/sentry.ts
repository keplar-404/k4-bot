// Sentry Agent Tracing (docs.sentry.io/platforms/javascript/guides/eve): errors, and
// spans for every turn's model calls, tool calls, tokens and fetches (Neon HTTP,
// Composio, Firecrawl). All turns of one eve session form one Sentry conversation.
// eve runs this file at startup, before the agent and the AI SDK load.
import * as Sentry from "@sentry/node";
import {
	defineInstrumentation,
	disableInstrumentation,
} from "eve/instrumentation";

const dsn = process.env.SENTRY_DSN;
const production = process.env.NODE_ENV === "production";

export default dsn
	? defineInstrumentation({
			...Sentry.eveInstrumentation({
				dsn,
				environment: production ? "production" : "development",
				// ponytail: 20% of production turns keeps the free plan's span quota; raise with traffic budget.
				tracesSampleRate: production ? 0.2 : 1,
				// console.error/warn (failed agent_event inserts, tool failures) become Sentry Logs.
				integrations: [
					Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
				],
			}),
			// The owner chose to keep prompts and replies in every environment. eve's default
			// sends private chats' content only in development (eve docs: instrumentation >
			// Control inputs and outputs). This includes users' app data and memory.
			tracePolicy: () => ({
				emit: true,
				recordInputs: true,
				recordOutputs: true,
			}),
		})
	: disableInstrumentation();
