// Shared plumbing for the browser tools: every script runs through the Browser Use
// harness on the agent's own Chrome (k4-agent.sh), wrapped so that
// - parallel calls each get their own harness daemon and tab (a free "slot"),
// - logins are shared: the agent's Chrome loads the shared cookie jar before the
//   script and merges its cookies back after (newest wins, under a file lock),
// - the tab the agent worked in is shown, because the user watches this Chrome live.
import { onComputer } from "./computer";

type Ctx = Parameters<typeof onComputer>[0] & { abortSignal: AbortSignal };

// Up to 4 parallel calls per agent. A slot is a lock directory holding its owner's pid,
// so a crashed call's slot is reclaimed; it is removed when the call ends. (A flock on
// an open fd would leak into the harness's background daemon and never be released.)
const SLOT = `for i in 1 2 3 4; do
  L=/tmp/k4-bu-$USER-$i
  if mkdir "$L" 2>/dev/null || { p=$(cat "$L/pid" 2>/dev/null); [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null && rm -rf "$L" && mkdir "$L"; }; then
    echo $$ > "$L/pid"; trap 'rm -rf "$L"' EXIT; export BU_NAME="$USER-$i"; break
  fi
done
[ -n "\${L:-}" ] && [ -f "$L/pid" ] || { echo "All 4 browser slots are busy; wait for one to finish." >&2; exit 75; }
browser-use`;

const WRAP = (script: string) => `import json, os, time, fcntl
__k4_jar_path = "/home/shared/.k4/cookies.json"
__k4_fields = ("name", "value", "domain", "path", "secure", "httpOnly", "sameSite", "expires", "priority", "sourceScheme")

def __k4_jar(update=None):
    folder = os.path.dirname(__k4_jar_path)
    if not os.path.isdir(folder):  # the image makes it; this is a fallback
        os.makedirs(folder, exist_ok=True)
        os.chmod(folder, 0o2770)
    with open(__k4_jar_path + ".lock", "a+") as lock:
        try:
            os.chmod(lock.name, 0o660)  # every agent takes this lock
        except PermissionError:
            pass  # made by another agent, already shared
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            with open(__k4_jar_path) as f:
                jar = json.load(f)
        except Exception:
            jar = {}
        if update is not None:
            now = time.time()
            for c in update:
                jar[c["name"] + "|" + c["domain"] + "|" + c["path"]] = c
            jar = {k: c for k, c in jar.items() if c.get("expires", -1) <= 0 or c["expires"] > now}
            tmp = __k4_jar_path + "." + str(os.getpid())
            with open(tmp, "w") as f:
                json.dump(jar, f)
            os.chmod(tmp, 0o660)
            os.replace(tmp, __k4_jar_path)
        return jar

def __k4_param(c):
    p = {k: c[k] for k in __k4_fields if k in c}
    if p.get("expires", -1) <= 0:
        p.pop("expires", None)  # a session cookie
    return p

try:
    __k4_cookies = [__k4_param(c) for c in __k4_jar().values()]
    if __k4_cookies:
        try:
            cdp("Storage.setCookies", cookies=__k4_cookies)
        except Exception:
            for c in __k4_cookies:  # one bad cookie must not drop the rest
                try:
                    cdp("Storage.setCookies", cookies=[c])
                except Exception:
                    pass
except Exception as e:
    print("(shared logins not loaded: %s)" % e)

__k4_script = ${JSON.stringify(script)}
try:
    exec(__k4_script, globals())
finally:
    try:
        __k4_jar(cdp("Storage.getCookies")["cookies"])
    except Exception:
        pass
    try:
        activate_tab(current_tab())
    except Exception:
        pass
`;

/** Runs harness Python on the agent's Chrome (see the file comment). */
export const runBrowser = (ctx: Ctx, script: string) =>
	onComputer(ctx, SLOT, {
		stdin: WRAP(script),
		timeoutMs: 180_000,
		signal: ctx.abortSignal,
	});
