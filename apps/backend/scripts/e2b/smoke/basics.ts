import { writeFileSync } from "node:fs";
import type { Sandbox } from "@e2b/desktop";
import { shot, step } from "./step";

/** Size, a shell command, a file round trip and a first screenshot. */
export async function checkBasics(sbx: Sandbox) {
  await step("sandbox size", () => sbx.getInfo(), (i) => `${i.cpuCount} vCPU, ${i.memoryMB} MiB, template ${i.name ?? i.templateId}`);

  await step("run a command", () => sbx.commands.run("uname -sr && . /etc/os-release && echo $PRETTY_NAME"), (r) => r.stdout.trim().replace(/\n/g, " | "));

  await step(
    "write and read a file",
    async () => {
      await sbx.files.write("/home/user/hello.txt", "hello from k4-bot");
      return sbx.files.read("/home/user/hello.txt");
    },
    (text) => JSON.stringify(text),
  );

  await step(
    "screenshot (empty desktop)",
    async () => {
      const png = await sbx.screenshot();
      writeFileSync(shot("1-desktop.png"), png);
      return png.byteLength;
    },
    (bytes) => `${bytes} bytes PNG`,
  );
}
