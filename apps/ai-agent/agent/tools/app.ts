// The everyday desktop-app tool, made for small models: open an app, read its window
// as a numbered list, click or type by number. Built on Cua Driver (the accessibility
// tree, background input); computer_app stays for everything else. The current window
// and snapshot live in a small file in the agent's home, so numbers stay valid across
// calls even when another server instance runs the next one.
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { onComputer, oneAtATime } from "../lib/computer";
import { notInPlan } from "../lib/mode";

const HELPER = `import json, os, subprocess, sys, time
SESSION = os.environ["K4_SESSION"]
STATE = os.path.expanduser("~/.k4-app.json")
SKIP = {"Xfdesktop", "Xfce4-panel", "Wrapper-2.0"}

def call(tool, args):
    r = subprocess.run(["cua-driver", "call", tool], input=json.dumps({"session": SESSION, **args}),
                       capture_output=True, text=True, timeout=90)
    try:
        return json.loads(r.stdout)
    except Exception:
        sys.exit((r.stdout or r.stderr).strip()[-1500:] or tool + " failed")

def load():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}

def save(d):
    json.dump(d, open(STATE, "w"))

def pick(title=None, pid=None):
    wins = [w for w in call("list_windows", {}).get("windows", [])
            if w.get("is_on_screen") and w.get("app_name") not in SKIP]
    if pid:
        wins = [w for w in wins if w["pid"] == pid] or wins
    if title:
        t = title.lower()
        match = [w for w in wins if t in (w.get("title", "") + " " + w.get("app_name", "")).lower()]
        if not match:
            sys.exit("No window matches %r. Open windows: %s" % (title, "; ".join(w.get("app_name", "") + ": " + w.get("title", "") for w in wins) or "none"))
        wins = match
    else:
        st = load()
        same = [w for w in wins if w.get("window_id") == st.get("window_id")]
        wins = same or wins
    if not wins:
        sys.exit("No app window is open. Use action open first.")
    return max(wins, key=lambda w: w.get("z_index", 0))

def read(title=None, pid=None):
    w = pick(title, pid)
    st = call("get_window_state", {"pid": w["pid"], "window_id": w["window_id"],
                                   "include_screenshot": False, "max_elements": 150})
    save({"pid": w["pid"], "window_id": w["window_id"], "snapshot": st.get("snapshot_id")})
    print("Window: %s - %s" % (w.get("app_name"), w.get("title")))
    if st.get("follow_up"):
        print("Note:", st["follow_up"])
    print(st.get("tree_markdown", "")[:6000])
    print("\\n(Use a [number] above with click or type.)")

def act(tool, n, extra):
    st = load()
    if not st.get("snapshot"):
        sys.exit("Read the window first.")
    r = call(tool, {"pid": st["pid"], "window_id": st["window_id"],
                    "element_token": "%s:%d" % (st["snapshot"], n), **extra})
    ok = r.get("ok", True) is not False and r.get("effect") not in ("refused",)
    print("%s [%d]: %s" % (tool, n, r.get("effect") or ("ok" if ok else r.get("message") or r.get("code") or "failed")))
    if r.get("hint"):
        print("Hint:", r["hint"])
    return ok
`;

const ACTION = {
	open: (a: { name?: string }) => `
r = call("launch_app", {"name": ${JSON.stringify(a.name)}})
if not r.get("running"):
    sys.exit(r.get("message") or ("Could not open %s. Try the app's command name (e.g. libreoffice --calc, gimp, gedit, galculator)." % ${JSON.stringify(a.name)}))
time.sleep(2)
read(pid=r.get("pid"))`,
	read: (a: { window?: string }) => `read(${JSON.stringify(a.window ?? null)})`,
	click: (a: { element?: number; elements?: number[] }) => `
for n in ${JSON.stringify(a.elements?.length ? a.elements : [a.element])}:
    if not act("click", n, {}):
        break
    time.sleep(0.2)
time.sleep(0.4)
read()`,
	type: (a: { element?: number; text?: string; submit?: boolean }) => `
text = ${JSON.stringify(a.text ?? "")}
if not act("set_value", ${a.element}, {"value": text}):
    act("type_text", ${a.element}, {"text": text})
${a.submit ? `act("press_key", ${a.element}, {"key": "Return"})` : ""}
time.sleep(0.5)
read()`,
} as const;

const tool = defineTool({
	description:
		"Use desktop apps on the user's computer (LibreOffice, GIMP, text editor, file manager, calculator…), step by step: `open` an app by name, `read` its window (a numbered list of buttons, fields, menus and text), `click` an item by its number (or several in order with `elements`, e.g. a whole calculation), `type` into a field by its number (submit: true presses Enter). Each action returns the window again. Desktop steps run one at a time per agent. The user watches live.",
	inputSchema: z.object({
		action: z.enum(["open", "read", "click", "type"]),
		name: z
			.string()
			.max(200)
			.optional()
			.describe(
				"For open: the app, e.g. galculator, gedit, libreoffice --calc",
			),
		window: z
			.string()
			.max(200)
			.optional()
			.describe("For read: part of a window title, to switch windows"),
		element: z
			.number()
			.int()
			.min(0)
			.max(10_000)
			.optional()
			.describe("For click and type: the [number] from read"),
		elements: z
			.array(z.number().int().min(0).max(10_000))
			.max(30)
			.optional()
			.describe(
				"For click: several numbers clicked in order in one step (e.g. keys 1, 2, ×, 1, 2, =)",
			),
		text: z.string().max(5000).optional().describe("For type"),
		submit: z.boolean().optional().describe("For type: press Enter after"),
	}),
	label: {
		start: ({ action, name, element }) =>
			action === "open"
				? `Open ${name}`
				: action === "read"
					? "Read the window"
					: `${action === "click" ? "Click" : "Type into"} item ${element}`,
	},
	async execute(input, ctx) {
		const missing =
			(input.action === "open" && !input.name) ||
			(input.action === "click" &&
				input.element === undefined &&
				!input.elements?.length) ||
			(input.action === "type" && input.element === undefined);
		if (missing)
			return {
				error: `${input.action} needs ${input.action === "open" ? "name" : "element"}`,
			};
		return onComputer(
			ctx,
			// One Cua Driver session per chat, as computer_app uses.
			oneAtATime(
				`env K4_SESSION=${JSON.stringify(`k4-${ctx.session.id}`)} python3 -`,
			),
			{
				stdin: HELPER + ACTION[input.action](input),
				timeoutMs: 120_000,
				signal: ctx.abortSignal,
			},
		);
	},
});

export default defineDynamic(notInPlan(tool));
