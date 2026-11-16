# Direct control (research preview)

Drive a computer yourself by running Simulang code on it.

Tasks hand Sai a goal and let Sai decide every click. Direct control is the other way round: your program, or your coding agent, drives the computer itself. You take control of one of your computers and send it blocks of Simulang (JavaScript). Each block runs on the computer, and you get back its value, its console output and, when it took one, a screenshot.

> **Research preview**
>
> Direct control is open to every account. Running code costs nothing extra, but the model calls it makes (`callLLM`, `ground`, `stateSatisfies`) are billed to your account like any other model call.

## When to use it

| You want to                                                          | Use                                   |
| -------------------------------------------------------------------- | ------------------------------------- |
| Describe the outcome and let Sai work it out                         | A task (`POST /v1/agents/message`)    |
| Control each step yourself, look at the screen between steps         | Direct control                        |
| Write a script once and replay it without a model deciding each step | Direct control                        |
| Have your coding agent see the screen with its own model             | Direct control through the MCP server |

## How it works

Direct control is a JavaScript REPL attached to the computer:

- Top-level `await` works, and variables persist from one block to the next. Declare them with `var`.
- The value of a block's last expression is its result.
- `console.log` output comes back in `logs`.
- `machine` is already bound to the computer you control.

```js title="Open a tab and search its snapshot"
var page = await machine.browser.newtab('https://news.ycombinator.com')
var snap = await page.snapshot()
snap.snapshot.grep('points')
```

Control is a lease: it holds the computer while it is open. Sai's own tasks and workflows on that computer wait until you close it, and you wait for them when they hold it. A lease that sends nothing for 10 minutes releases the computer and closes; if something is waiting for the computer, that happens after 2 minutes.

## Control is not a session

The API's [sessions](/documentation/concepts/sessions) are conversations with Sai, with ids that start with `cs_`. Control is a short lease on one machine, addressed by the machine (`/v1/machines/{machineId}/control`), with no id of its own. It has no messages, no model of its own and no approvals.

## What comes back

Every block returns the same shape (see [Control](/documentation/api-reference/control#exec)):

- `result`: the block's value as JSON. A snapshot comes back as its outline text.
- `logs`: console output, up to 200 lines.
- `error`: set when the block did not finish. `kind` is `exception`, `timeout` or `interrupted`.
- `observations.screenshot`: present only when the block itself captured the screen, through `machine.pageContent()`, a page or app snapshot, or `page.screenshot()` / `app.screenshot()`.
- `variables`: every variable the REPL holds, with its type and a short preview.

The accessibility tree is never attached on its own. Read it with `snap.snapshot.outline()` or `grep()` and return what you need.

## Simulang in direct control

Shell and files:

```js title="Shell and files"
await machine.exec({ command, cwd?, timeout? })   // → { stdout, stderr, exitCode, timedOut }
await machine.readFile({ path })                  // → the file's text
await machine.writeToFile({ text, path, overwrite? }) // appends unless overwrite: true
```

Screen and input (coordinates are screen pixels):

```js title="Screen and input"
await machine.pageContent()                       // → { text: Snapshot, imageBase64 } of the whole screen, also returned as the screenshot
await machine.ground({ concept, app? })           // → { x, y }, found by a vision model
await machine.stateSatisfies({ condition })       // → boolean, judged by a vision model
await machine.click({ x, y })   // also move, drag({ fromX, fromY, toX, toY })
await machine.type({ text })    // also press({ key }), shortCut({ key }), scroll({ direction })
await machine.copyToClipboard({ text }) / machine.getFromClipboard()
```

Apps and windows:

```js title="Apps and windows"
await machine.open({ app?, url? })
var app = await machine.launch('notepad')         // → App
await machine.getAppWindow(title)                 // → App[]
await machine.listWindows() / machine.focusedWindow()
```

Browser, over Chrome DevTools (prefer this for web pages):

```js title="Browser"
var page = await machine.browser.newtab(url?)     // also browser.listTabs(), browser.getTab(id)
await page.goto({ url })                          // also url(), back(), reload()
var snap = await page.snapshot()                  // → { snapshot, refs, url, title }, plus a screenshot
await page.click({ ref })                         // also type({ ref, text, submit? }), press({ key }),
                                                  // fill({ fields }), select({ ref, values }), scroll({ direction })
await page.find(query) / page.waitFor(query)      // a selector match, with a model fallback
await page.evaluate({ fn })
```

Native apps, through the accessibility tree:

```js title="Native apps"
var snap = await app.snapshot() // → { snapshot, refs }, plus a screenshot
await app.click({ ref }) // also type({ ref, text }), press({ key }), scroll({ ref }), find(query)
```

Refs come from the latest snapshot: snapshot, act, snapshot again.

A snapshot reads like this:

```js title="Read a snapshot"
snap.snapshot.outline() // Markdown with refs inline, e.g. [Save](ref=e5)
snap.snapshot.grep(pattern)
snap.snapshot.read(line, { context: 5 })
await snap.snapshot.find(query)
```

Also: `await wait({ waitTime: 2 })` (seconds), and the REPL variables `$lastVisualObservation`, `$lastAccessibilityObservation` and `$lastExec`.

`callLLM({ prompt, context })` answers a question about the screen with a model, billed to your account, and `showMessageToUser({ message })` writes `[message] ...` to the block's `logs`, so [learned code](/documentation/concepts/learned-code) runs unchanged.

Not available in direct control: `sai.*`, integrations (Google, Slack and the rest), `askUser`, `askChoice`, `requestApproval`, `generateImage` and secrets. Call those from your own program.

## Computers

Direct control runs on any of your computers, on paid and free plans: a Sai cloud computer (Windows, Linux or macOS), or your own Mac or Windows PC while the Sai Agent is running and the computer is awake. On your own computer, [turn it on](/documentation/concepts/computers#turn-on-code-on-your-own-computer) first. The code uses your real screen, mouse and keyboard, so leave them alone while a lease is open.

A free plan's cloud computer is started for the lease and deleted after it. Anything on its disk is gone when the lease closes. Opening control on it can take about two minutes.

## Billing

There is no charge for direct control itself. The computer's time counts like any other use of it (see [Billing and limits](/documentation/concepts/billing-and-limits)), and the model calls behind `ground`, `stateSatisfies` and the `find` fallback count toward your usage like Sai's own.

## Safety

There are no approvals in direct control. You own the computer, and a block can already run any shell command with `machine.exec`, so a block can do anything on the computer you could do yourself. Keep secrets out of your code: nothing in direct control reads Sai's stored secrets.
