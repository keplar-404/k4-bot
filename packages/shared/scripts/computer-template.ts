// Builds the E2B template every user's computer starts from (src/computer.ts).
// Run once, and again after changing it:
//   cd packages/shared && bun --env-file=../../apps/ai-agent/.env scripts/computer-template.ts
import { defaultBuildLogger, Template } from "e2b";
import { COMPUTER_TEMPLATE } from "../src/computer";

// E2B's `desktop` template: Ubuntu 22.04 + XFCE with LibreOffice, xfce4-terminal,
// gedit, galculator, pcmanfm and xpdf already installed. We add a browser and apps.
// Ubuntu 22.04's `chromium` package is only a snap stub (no snapd in a sandbox), so
// the browser is Google Chrome from Google's .deb: the same engine, a real package.
const template = Template({ fileContextPath: import.meta.dir })
	.fromTemplate("desktop")
	.runCmd(
		[
			"apt-get update",
			"wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb",
			"DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/chrome.deb gimp ristretto file-roller fonts-noto-core fonts-noto-color-emoji ffmpeg poppler-utils",
			"rm -f /tmp/chrome.deb",
			"apt-get clean && rm -rf /var/lib/apt/lists/*",
		],
		{ user: "root" },
	)
	// Agent harnesses, installed for the desktop user (both validated on this image):
	// Cua Driver drives desktop apps through the accessibility tree; the Browser Use
	// harness drives Chrome over CDP. Pinned, because both projects move fast.
	.runCmd(
		[
			"curl -fsSL https://cua.ai/driver/install.sh | bash",
			"curl -LsSf https://astral.sh/uv/install.sh | sh",
			"~/.local/bin/uv tool install 'browser-use==1.0.6'",
			"~/.local/bin/cua-driver --version && ~/.local/bin/browser-use --version",
		],
		{ user: "user" },
	)
	// Each agent gets its own Linux user and desktop (k4-agent.sh), so the harnesses
	// are copied system-wide, plus a group folder every agent shares.
	.copy("k4-agent.sh", "/usr/local/bin/k4-agent", { user: "root", mode: 0o755 })
	.runCmd(
		[
			"install -m 755 /home/user/.local/bin/cua-driver /usr/local/bin/cua-driver",
			"mkdir -p /opt/uv && UV_TOOL_DIR=/opt/uv/tools UV_TOOL_BIN_DIR=/usr/local/bin UV_PYTHON_INSTALL_DIR=/opt/uv/python /home/user/.local/bin/uv tool install 'browser-use==1.0.6'",
			// yt-dlp from apt (Ubuntu 22.04) is too old for today's sites.
			"UV_TOOL_DIR=/opt/uv/tools UV_TOOL_BIN_DIR=/usr/local/bin UV_PYTHON_INSTALL_DIR=/opt/uv/python /home/user/.local/bin/uv tool install yt-dlp",
			"groupadd -f k4 && usermod -aG k4 user && install -d -m 2775 -g k4 /home/shared && ln -sfn /home/shared /home/user/Shared",
			// Agents' only sudo (`k4-install PKG`) is written on every start by
			// src/computer.ts ensureStream, so old images get the same rule.
			"/usr/local/bin/browser-use --version && /usr/local/bin/cua-driver --version && yt-dlp --version && ffmpeg -version && pdftotext -v",
		],
		{ user: "root" },
	)
	// Live view straight to the browser (src/computer.ts ensureStream): websockify
	// checks a signed token with its JWTTokenApi plugin (needs jwcrypto), and iptables
	// keeps every port but the stream and E2B's envd closed to the outside.
	.runCmd(
		[
			"apt-get update",
			"DEBIAN_FRONTEND=noninteractive apt-get install -y iptables python3-jwcrypto",
			"apt-get clean && rm -rf /var/lib/apt/lists/*",
			"python3 -c 'import jwcrypto' && iptables --version",
		],
		{ user: "root" },
	);

await Template.build(template, COMPUTER_TEMPLATE, {
	// Room for the user's desktop plus up to 4 agent desktops (each XFCE + Chrome).
	cpuCount: 4,
	memoryMB: 8192,
	onBuildLogs: defaultBuildLogger(),
});
console.log(`template ${COMPUTER_TEMPLATE} ready`);
