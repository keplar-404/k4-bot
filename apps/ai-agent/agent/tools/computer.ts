import {
	getScreenshot,
	newScreenshotKey,
	putScreenshot,
} from "@repo/shared/storage";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import { getUserDesktop } from "../lib/desktop";

// Drives a Linux desktop (E2B Desktop: Ubuntu + XFCE, 1280x800) with mouse,
// keyboard and shell. Every action returns a fresh screenshot so the model
// sees the result. API per docs.e2b.dev/use-cases/computer-use.
// [x, y]. Not z.tuple: its JSON Schema uses array-form `items`, which some
// providers behind OpenRouter reject, failing the whole model call.
const point = z.array(z.number().int().min(0).max(1279)).length(2);

export default defineTool({
	description: [
		"Use a Linux desktop (Ubuntu, XFCE, 1280x800, Firefox and LibreOffice installed).",
		"Actions: screenshot; left_click/right_click/double_click/move at `at` [x,y];",
		"drag from `at` to `to`; type `text`; key `keys` (xdotool names, e.g. 'Return', 'ctrl+l');",
		"scroll `direction` by `amount`; open `target` (URL or file); run `command` in a shell.",
		"Each call returns a screenshot afterwards. Take a screenshot first to find coordinates.",
	].join(" "),
	inputSchema: z.object({
		action: z.enum([
			"screenshot",
			"left_click",
			"right_click",
			"double_click",
			"move",
			"drag",
			"type",
			"key",
			"scroll",
			"open",
			"run",
		]),
		at: point.optional(),
		to: point.optional(),
		text: z.string().optional(),
		keys: z.string().optional(),
		direction: z.enum(["up", "down"]).optional(),
		amount: z.number().int().min(1).max(20).optional(),
		target: z.string().optional(),
		command: z.string().optional(),
	}),
	label: {
		start: (i) =>
			i.action === "run"
				? `Run \`${i.command ?? ""}\` on the desktop`
				: i.action === "type"
					? "Type on the desktop"
					: `Desktop: ${i.action.replace("_", " ")}`,
	},
	async execute(input, ctx) {
		const { userId, desktop, streamUrl } = await getUserDesktop(
			ctx.session.auth.current,
		);
		const need = <T>(v: T | undefined, name: string): T => {
			if (v === undefined)
				throw new Error(`\`${name}\` is required for ${input.action}.`);
			return v;
		};
		// The schema guarantees two numbers.
		const xy = (p: number[] | undefined, name: string) =>
			need(p, name) as [number, number];
		let stdout: string | undefined;
		let stderr: string | undefined;
		let exitCode: number | undefined;
		switch (input.action) {
			case "screenshot":
				break;
			case "left_click":
				await desktop.leftClick(...xy(input.at, "at"));
				break;
			case "right_click":
				await desktop.rightClick(...xy(input.at, "at"));
				break;
			case "double_click":
				await desktop.doubleClick(...xy(input.at, "at"));
				break;
			case "move":
				await desktop.moveMouse(...xy(input.at, "at"));
				break;
			case "drag":
				await desktop.drag(xy(input.at, "at"), xy(input.to, "to"));
				break;
			case "type":
				await desktop.write(need(input.text, "text"));
				break;
			case "key":
				await desktop.press(need(input.keys, "keys"));
				break;
			case "scroll":
				await desktop.scroll(input.direction ?? "down", input.amount ?? 3);
				break;
			case "open":
				await desktop.open(need(input.target, "target"));
				break;
			case "run": {
				// A non-zero exit throws in the SDK; report it instead of failing the call.
				const r = await desktop.commands
					.run(need(input.command, "command"), { timeoutMs: 120_000 })
					.catch(
						(e: { stdout?: string; stderr?: string; exitCode?: number }) => e,
					);
				stdout = (r.stdout ?? "").slice(-8000);
				stderr = (r.stderr ?? "").slice(-4000);
				exitCode = r.exitCode;
				break;
			}
		}
		if (ctx.abortSignal.aborted) throw new Error("Cancelled.");
		// Give the UI a moment to settle before capturing.
		if (input.action !== "screenshot" && input.action !== "run")
			await desktop.wait(500);
		// The image goes to object storage; only its key is kept in the event log.
		const screenshotKey = newScreenshotKey(userId);
		await putScreenshot(screenshotKey, await desktop.screenshot());
		return {
			action: input.action,
			streamUrl,
			...(input.action === "run"
				? { command: input.command, stdout, stderr, exitCode }
				: {}),
			screenshotKey,
		};
	},
	async toModelOutput(output) {
		const { screenshotKey, streamUrl: _s, ...rest } = output;
		const png = await getScreenshot(screenshotKey);
		return toolOutput.content([
			toolOutputPart.text(JSON.stringify(rest)),
			toolOutputPart.file(Buffer.from(png).toString("base64"), {
				mediaType: "image/png",
			}),
		]);
	},
});
