import type { Sandbox } from "@e2b/desktop";
import { botHome, checkKeys, checkTypedText, checkUrl, shellQuote } from "../guards";
import type { ComputerAction } from "../types";
import { appProfileDir, runAs } from "./accounts";
import { sleep } from "./constants";

const q = (n: number) => String(Math.round(n));

/**
 * Does one mouse/keyboard action as `user` on the shared screen. Returns what happened, or a refusal from the
 * guards (typed secrets, key names, URLs) that the agent is told instead.
 */
export async function doAction(sbx: Sandbox, user: string, action: ComputerAction, allowedHosts: string[]): Promise<{ ok: true; text: string } | { ok: false; text: string }> {
  const run = (cmd: string) => sbx.commands.run(cmd);
  switch (action.action) {
    case "screenshot":
      return { ok: true, text: "Screenshot taken." };
    case "mouse_move":
      await run(`xdotool mousemove ${q(action.x)} ${q(action.y)}`);
      return { ok: true, text: `Moved the mouse to (${action.x}, ${action.y}).` };
    case "left_click":
    case "right_click":
    case "middle_click": {
      const button = { left_click: 1, right_click: 3, middle_click: 2 }[action.action];
      // No `--sync`: it waits ~15s when the pointer is already at the target.
      await run(`xdotool mousemove ${q(action.x)} ${q(action.y)} click ${button}`);
      return { ok: true, text: `${action.action.replace("_", " ")} at (${action.x}, ${action.y}).` };
    }
    case "double_click":
      await run(`xdotool mousemove ${q(action.x)} ${q(action.y)} click --repeat 2 --delay 80 1`);
      return { ok: true, text: `Double-clicked at (${action.x}, ${action.y}).` };
    case "left_click_drag":
      await run(`xdotool mousemove ${q(action.x)} ${q(action.y)} mousedown 1 sleep 0.15 mousemove ${q(action.toX)} ${q(action.toY)} sleep 0.15 mouseup 1`);
      return { ok: true, text: `Dragged from (${action.x}, ${action.y}) to (${action.toX}, ${action.toY}).` };
    case "type": {
      const checked = checkTypedText(action.text);
      if (!checked.ok) return { ok: false, text: checked.reason };
      for (let i = 0; i < action.text.length; i += 500) {
        await run(`xdotool type --delay 12 --clearmodifiers -- ${shellQuote(action.text.slice(i, i + 500))}`);
      }
      return { ok: true, text: `Typed ${action.text.length} characters.` };
    }
    case "key": {
      const keys = checkKeys(action.keys);
      if (!keys.ok) return { ok: false, text: keys.reason };
      await run(`xdotool key --clearmodifiers ${keys.value.map(shellQuote).join(" ")}`);
      return { ok: true, text: `Pressed ${keys.value.join(" ")}.` };
    }
    case "scroll": {
      if (action.x !== undefined && action.y !== undefined) await run(`xdotool mousemove ${q(action.x)} ${q(action.y)}`);
      const button = { up: 4, down: 5, left: 6, right: 7 }[action.direction];
      await run(`xdotool click --repeat ${action.amount} --delay 40 ${button}`);
      return { ok: true, text: `Scrolled ${action.direction} by ${action.amount}.` };
    }
    case "wait":
      await sleep(action.seconds * 1000);
      return { ok: true, text: `Waited ${action.seconds}s.` };
    case "open_url": {
      const checked = checkUrl(action.url, allowedHosts);
      if (!checked.ok) return { ok: false, text: checked.reason };
      await openInBrowser(sbx, user, checked.value, action.app);
      return { ok: true, text: `Opened ${checked.value} in your ${action.app ? `${action.app.toolkit} login` : "browser"} window.` };
    }
  }
}

/**
 * Own profile + own window class per bot: cookies and windows are never shared between bots. With `app`, a separate
 * profile per connected app account, so each login stays apart and is deleted when that account is disconnected.
 */
async function openInBrowser(sbx: Sandbox, user: string, url: string, app?: { toolkit: string; accountId: string }) {
  const dir = app ? appProfileDir(user, app.toolkit, app.accountId) : `${botHome(user)}/.chrome`;
  // 700 from .k4 down: other bots may read this home, never its logins.
  if (app) await runAs(sbx, user, `mkdir -p ${shellQuote(dir)} && chmod 700 ${shellQuote(`${botHome(user)}/.k4`)} ${shellQuote(dir)}`, 15_000);
  await runAs(
    sbx,
    user,
    `nohup google-chrome --class=${shellQuote(`k4_${user}`)} --user-data-dir=${shellQuote(dir)} ` +
      `--no-first-run --no-default-browser-check --start-maximized --new-window ${shellQuote(url)} >/dev/null 2>&1 &`,
    15_000,
    true,
  );
  // A cold Chrome start takes several seconds: wait for its window instead of returning a desktop screenshot.
  await runAs(sbx, user, `for i in $(seq 1 30); do xdotool search --onlyvisible --class ${shellQuote(`k4_${user}`)} >/dev/null 2>&1 && break; sleep 0.5; done`, 20_000);
}

/** Switching bots: bring that bot's windows to the front before it acts. */
export const focusBotWindows = (sbx: Sandbox, user: string) =>
  sbx.commands.run(`xdotool search --onlyvisible --class ${shellQuote(`k4_${user}`)} | head -1 | xargs -r xdotool windowactivate`).catch(() => undefined);
