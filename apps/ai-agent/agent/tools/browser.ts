// The everyday browser tool, made for small models: a few plain actions on the agent's
// own Chrome, and plain-text results with numbered elements to act on. Built on the
// Browser Use harness (lib/browser.ts); computer_browser stays for anything else.
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { runBrowser } from "../lib/browser";
import { notInPlan } from "../lib/mode";

// Page text plus every visible link, button and field, numbered. The numbers are
// written into the page (data-k4) so click/type find the same element afterwards.
const READ = `
def __k4_read():
    wait_for_load()
    info = js("""(() => {
      const els = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[contenteditable=true]')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })
        .slice(0, 80);
      document.querySelectorAll('[data-k4]').forEach(e => e.removeAttribute('data-k4'));
      const items = els.map((e, i) => {
        e.setAttribute('data-k4', String(i + 1));
        const label = (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.value || e.name || e.title || '').trim().replace(/\\\\s+/g, ' ').slice(0, 80);
        const kind = e.tagName === 'A' ? 'link' : e.tagName === 'INPUT' ? 'field' + (e.type && e.type !== 'text' ? ':' + e.type : '') : e.tagName === 'TEXTAREA' ? 'field' : e.tagName === 'SELECT' ? 'select' : 'button';
        return '[' + (i + 1) + '] ' + kind + ': ' + label;
      });
      const text = (document.body ? document.body.innerText : '').replace(/\\\\n{3,}/g, '\\\\n\\\\n').slice(0, 4000);
      return JSON.stringify({ title: document.title, url: location.href, text, items });
    })()""")
    d = json.loads(info)
    print("Page:", d["title"], "-", d["url"])
    print("\\nText:\\n" + d["text"])
    print("\\nElements (use the number with click or type):\\n" + "\\n".join(d["items"]))
`;

const ACTIONS = {
	open: (a: { url?: string }) => `
if current_tab() and current_tab()["url"] not in ("about:blank", ""):
    goto_url(${JSON.stringify(a.url)})
else:
    new_tab(${JSON.stringify(a.url)})
__k4_read()`,
	read: () => "__k4_read()",
	click: (a: { element?: number }) => `
box = js("""(() => { const e = document.querySelector('[data-k4="${a.element}"]'); if (!e) return null; e.scrollIntoView({block: 'center'}); const r = e.getBoundingClientRect(); return JSON.stringify([r.x + r.width / 2, r.y + r.height / 2]); })()""")
if not box:
    print("Element ${a.element} is not on the page any more: call read again.")
else:
    x, y = json.loads(box)
    click_at_xy(x, y)
    __k4_read()`,
	type: (a: { element?: number; text?: string; submit?: boolean }) => `
box = js("""(() => { const e = document.querySelector('[data-k4="${a.element}"]'); if (!e) return null; e.scrollIntoView({block: 'center'}); e.focus(); if ('value' in e) e.value = ''; const r = e.getBoundingClientRect(); return JSON.stringify([r.x + r.width / 2, r.y + r.height / 2]); })()""")
if not box:
    print("Element ${a.element} is not on the page any more: call read again.")
else:
    x, y = json.loads(box)
    click_at_xy(x, y)
    cdp("Input.insertText", text=${JSON.stringify(a.text ?? "")})
    ${
			a.submit
				? `cdp("Input.dispatchKeyEvent", type="keyDown", key="Enter", code="Enter", windowsVirtualKeyCode=13)
    cdp("Input.dispatchKeyEvent", type="keyUp", key="Enter", code="Enter", windowsVirtualKeyCode=13)`
				: "pass"
		}
    __k4_read()`,
	back: () => `
js("history.back()")
__k4_read()`,
} as const;

const tool = defineTool({
	description:
		"Use Chrome on the user's computer, step by step: `open` a URL, `read` the page (text plus numbered links, buttons and fields), `click` an element by its number, `type` text into a field by its number (submit: true presses Enter), or go `back`. Each action returns the page again. The user watches live; for a captcha or sign-in, ask the user to take control.",
	inputSchema: z.object({
		action: z.enum(["open", "read", "click", "type", "back"]),
		url: z.string().url().max(2000).optional().describe("For open"),
		element: z
			.number()
			.int()
			.min(1)
			.max(80)
			.optional()
			.describe("For click and type: the number from read"),
		text: z.string().max(5000).optional().describe("For type"),
		submit: z.boolean().optional().describe("For type: press Enter after"),
	}),
	label: {
		start: ({ action, url, element }) =>
			action === "open"
				? `Open ${url}`
				: action === "click" || action === "type"
					? `${action === "click" ? "Click" : "Type into"} element ${element}`
					: action === "back"
						? "Go back"
						: "Read the page",
	},
	async execute(input, ctx) {
		const need =
			input.action === "open"
				? input.url
				: input.action === "click" || input.action === "type"
					? input.element
					: true;
		if (!need)
			return {
				error: `${input.action} needs ${input.action === "open" ? "url" : "element"}`,
			};
		return runBrowser(ctx, READ + ACTIONS[input.action](input));
	},
});

export default defineDynamic(notInPlan(tool));
