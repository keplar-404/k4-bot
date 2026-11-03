import type { Sandbox } from "@e2b/desktop";
import { step } from "./step";

/** E2B's own password-protected stream: the page loads, and the VNC server refuses a client without the password. */
export async function checkStream(sbx: Sandbox, holdSeconds: number) {
  const watchUrl = await step(
    "start live stream (password protected)",
    async () => {
      await sbx.stream.start({ requireAuth: true });
      return sbx.stream.getUrl({ authKey: sbx.stream.getAuthKey() });
    },
    () => "URL printed below",
  );
  if (!watchUrl) return;

  await step(
    "live view page loads (HTTP 200, noVNC)",
    async () => {
      const res = await fetch(watchUrl);
      const html = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!/noVNC/i.test(html)) throw new Error("not the noVNC page");
      return res.status;
    },
    (status) => `HTTP ${status}`,
  );

  await step("stream demands the password (VNC auth enforced)", () => vncSecurityTypes(watchUrl), (v) => v);

  console.log(`\nLIVE VIEW (open in a browser; contains a password): ${watchUrl}\n`);
  if (holdSeconds > 0) {
    console.log(`Holding the desktop open for ${holdSeconds}s so you can watch...`);
    await new Promise((r) => setTimeout(r, holdSeconds * 1000));
  }
}

/**
 * Talks to the VNC server the way the noVNC page does (RFB over a websocket)
 * and reads which security types it offers: 2 = password, 1 = none.
 */
async function vncSecurityTypes(watchUrl: string): Promise<string> {
  const ws = new WebSocket(`wss://${new URL(watchUrl).host}/websockify`, ["binary"]);
  ws.binaryType = "arraybuffer";
  const queue: Uint8Array[] = [];
  ws.addEventListener("message", (m) => queue.push(new Uint8Array(m.data as ArrayBuffer)));
  const next = async () => {
    for (let waited = 0; queue.length === 0; waited += 100) {
      if (waited > 15_000) throw new Error("no reply from the VNC server");
      await new Promise((r) => setTimeout(r, 100));
    }
    return queue.shift()!;
  };
  try {
    const hello = await next();
    const version = new TextDecoder().decode(hello);
    if (!version.startsWith("RFB")) throw new Error(`not a VNC server: ${JSON.stringify(version)}`);
    ws.send(hello);
    const security = await next();
    const types = Array.from(security.slice(1, 1 + security[0]!));
    if (!types.includes(2) || types.includes(1)) throw new Error(`security types ${JSON.stringify(types)}: no password required`);
    return `${version.trim()}, security types ${JSON.stringify(types)} (2 = password)`;
  } finally {
    ws.close();
  }
}
