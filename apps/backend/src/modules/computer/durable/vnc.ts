import type { Sandbox } from "@e2b/desktop";
import { CONTROL, type Ports, sleep, VIEW } from "./constants";

/**
 * Which of our VNC servers are up with the current flags. A server started by an older version
 * (without `-noxdamage`) counts as down, so it is replaced and the preview gets the fix too.
 */
async function vncUp(sbx: Sandbox) {
  const r = await sbx.commands.run(`ss -ltn | awk '{print $4}'; echo ===; pgrep -af x11vnc || true`);
  const [ports = "", procs = ""] = r.stdout.split("===");
  const ok = (p: Ports) => ports.includes(`:${p.web}`) && procs.split("\n").some((l) => l.includes(`-rfbport ${p.vnc}`) && l.includes("-noxdamage"));
  return { view: ok(VIEW), control: ok(CONTROL) };
}

/**
 * Starts the two VNC servers (read-only and interactive) on first use. Idempotent.
 * `-noxdamage`: x11vnc otherwise waits for X "damage" events, and Chrome's compositor does not send them
 * for most of what it draws, so the preview froze while a bot scrolled or typed in the browser (verified).
 * Without them x11vnc compares the screen itself every `-wait` ms (50, as E2B's own stream does).
 */
export async function startVnc(sbx: Sandbox) {
  const up = await vncUp(sbx);
  const start = async (ports: Ports, viewOnly: boolean) => {
    // "[-]": the pattern must not match this very shell's own command line, or pkill kills it too.
    await sbx.commands.run(`pkill -f "[-]rfbport ${ports.vnc}"; pkill -f "[-]-listen ${ports.web}"; true`);
    await sbx.commands.run(
      `x11vnc -bg -display ${sbx.display} -forever -shared -nopw -noxdamage -wait 50 ${viewOnly ? "-viewonly " : ""}-rfbport ${ports.vnc} 2>/tmp/x11vnc-${ports.vnc}.log`,
    );
    await sbx.commands.run(
      `cd /opt/noVNC/utils && nohup ./novnc_proxy --vnc localhost:${ports.vnc} --listen ${ports.web} --web /opt/noVNC >/tmp/novnc-${ports.web}.log 2>&1 &`,
      { background: true, timeoutMs: 0 },
    );
  };
  if (!up.view) await start(VIEW, true);
  if (!up.control) await start(CONTROL, false);
  for (let i = 0; i < 20; i++) {
    const now = await vncUp(sbx);
    if (now.view && now.control) break;
    await sleep(300);
  }
}
