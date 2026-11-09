import type { Sandbox } from "@e2b/desktop";
import { purgeAccounts, wipeAppProfiles, writeDirectory } from "./accounts";
import { ComputerSleep } from "./sleep";
import { startVnc } from "./vnc";

/** Upkeep of the VM itself: the feature switch, the screen servers, deleted bots' accounts, disconnected apps' logins and /home/BOTS.md. */
export class ComputerMachine extends ComputerSleep {
  protected assertEnabled() {
    const cfg = this.cfg;
    if (!cfg.COMPUTER_ENABLED) throw new Error("The computer feature is turned off.");
    if (!cfg.E2B_API_KEY) throw new Error("The computer is not configured on this server.");
  }

  protected async ensureVnc(sbx: Sandbox) {
    if (this.vncFor === sbx.sandboxId) return;
    await startVnc(sbx);
    this.vncFor = sbx.sandboxId;
  }

  protected async purgeRemovedBots(sbx: Sandbox) {
    const purged = await purgeAccounts(sbx, this.tables, this.botUsers);
    await wipeAppProfiles(sbx, this.tables);
    if (purged > 0 || this.directoryDirty) await this.writeDirectory(sbx);
  }

  protected async writeDirectory(sbx: Sandbox) {
    await writeDirectory(sbx, this.tables);
    this.directoryDirty = false;
  }
}
