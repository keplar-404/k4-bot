// The user's computer (packages/shared/src/computer.ts), for the web's Computer panel.
//
//   GET  /api/me/computer?session=ID  -> starts/resumes it; returns a live-view URL for
//        that chat's agent screen, or the user's own screen when that agent has none
//   POST /api/me/computer/pause       -> pauses it now (the Stop button)
//
// The stream itself never passes through this server: the browser connects straight
// to the computer, whose websockify accepts only a token signed here for one screen.
import { zValidator } from "@hono/zod-validator";
import {
	agentDisplay,
	computerOn,
	pauseComputer,
	streamToken,
	userDesktop,
} from "@repo/shared/computer";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

export const myComputer = new Hono<Env>()
	.use(requireUser)
	.get(
		"/",
		zValidator("query", z.object({ session: z.string().max(200).optional() })),
		async (c) => {
			const { sbx, streamPassword, streamKey } = await userDesktop(
				db,
				c.get("user").id,
			);
			const { session } = c.req.valid("query");
			// An agent screen exists only on this user's own computer, so a session id
			// from another user's chat can't reach anything that isn't theirs.
			const display = session ? await agentDisplay(sbx, session) : null;
			const token = await streamToken(streamKey, 5900 + (display ?? 0));
			const url = new URL(`https://${sbx.getHost(6080)}/vnc.html`);
			url.searchParams.set("autoconnect", "true");
			url.searchParams.set("resize", "scale");
			url.searchParams.set("path", `websockify?token=${token}`);
			url.searchParams.set("password", streamPassword);
			// noVNC reconnects by itself (with the same token, valid 15 minutes).
			url.searchParams.set("reconnect", "true");
			url.searchParams.set("reconnect_delay", "1000");
			// When the computer was last turned on (E2B), for the panel's uptime.
			const { startedAt } = await sbx.getInfo();
			return c.json(
				{
					url: url.toString(),
					desktop: display === null ? "yours" : "agent",
					startedAt: startedAt.toISOString(),
				},
				200,
			);
		},
	)
	// Opening the panel only asks; the computer starts when the user turns it on.
	.get("/status", async (c) =>
		c.json({ on: await computerOn(db, c.get("user").id) }, 200),
	)
	// The panel's Stop button. Running agents' next computer call resumes it.
	.post("/pause", async (c) =>
		c.json({ paused: await pauseComputer(db, c.get("user").id) }, 200),
	);
