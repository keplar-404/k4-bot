// Frees a helper's slot (lib/helpers.ts) when its `agent` call ends in any way.
import { call } from "eve/events";
import { defineHook } from "eve/hooks";
import { helperDone } from "../lib/helpers";

export default defineHook({
	events: {
		"call.settled"(event, ctx) {
			if (call(ctx.view, event.data.callId)?.name === "agent")
				helperDone(event.data.callId);
		},
	},
});
