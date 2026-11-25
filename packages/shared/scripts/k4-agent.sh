#!/bin/bash
# k4-agent NAME: one agent's own desktop on the user's computer. Run as root.
# Creates (once) and starts (if stopped) everything that agent uses, apart from every
# other agent: a Linux user NAME with its own home, X display :N, XFCE on its own D-Bus
# session (Cua Driver reads AT-SPI on that bus), x11vnc + noVNC for the live view,
# Chrome with its own CDP port and profile, and its own Cua Driver daemon.
# Prints N. Ports: VNC 5900+N (shown through the computer's one token-checked
# websockify on 6080), Chrome CDP 9222+N. At most K4_MAX_AGENTS
# desktops run at once; the least recently used one gives up its slot.
# Commands then run as the agent with: runuser -u NAME -- bash -c '. /home/NAME/.k4env; CMD'
#   k4-agent --peek NAME   prints N if NAME has a desktop, nothing otherwise.
set -euo pipefail

peek=0
[ "${1:-}" = "--peek" ] && { peek=1; shift; }
name="${1:-}"
[[ "$name" =~ ^a[0-9a-f]{10}$ ]] || { echo "bad agent name" >&2; exit 2; }
state=/var/lib/k4
max="${K4_MAX_AGENTS:-4}"
mkdir -p "$state"
exec 9>"$state/.lock"
flock 9

if [ -f "$state/$name" ]; then
	n=$(cat "$state/$name")
elif [ "$peek" = 1 ]; then
	exit 0
else
	n=""
	for i in $(seq 1 "$max"); do
		grep -qsx "$i" "$state"/a* || { n=$i; break; }
	done
	if [ -z "$n" ]; then
		# All slots taken: stop the least recently used idle agent's desktop and reuse
		# its display. Its Linux user and files stay; its desktop restarts when next
		# used. An agent with a command running (runOnComputer's /tmp/k4-*.sh) is busy.
		old=""
		for f in $(ls -tr "$state"/a*); do
			pgrep -u "$(basename "$f")" -f '^bash /tmp/k4-' >/dev/null || { old=$f; break; }
		done
		[ -n "$old" ] || { echo "All $max agent desktops are busy. Try again in a moment." >&2; exit 75; }
		n=$(cat "$old")
		pkill -u "$(basename "$old")" || true
		rm -f "$old" "/tmp/.X11-unix/X$n" "/tmp/.X$n-lock"
	fi
	echo "$n" >"$state/$name"
fi
[ "$peek" = 1 ] && { echo "$n"; exit 0; }
touch "$state/$name" # last use, for future cleanup

home=/home/$name
if ! id -u "$name" >/dev/null 2>&1; then
	useradd -m -s /bin/bash -G k4 "$name"
	ln -s /home/shared "$home/Shared"
	mkdir -p "$home/.vnc"
	cp /home/user/.vnc/passwd "$home/.vnc/passwd" # same view password as the computer
	chown -R "$name:$name" "$home/.vnc"
fi

# Every agent (and the user) can read every agent's home, like one shared computer;
# each writes only its own. Re-applied each run, so older homes catch up.
chgrp k4 "$home" /home/user && chmod 750 "$home" /home/user
# Shared browser logins (cookies), merged by the browser tool after each use.
install -d -m 2770 -g k4 /home/shared/.k4

as() { runuser -u "$name" -- "$@"; }
# Detached, with no handle on this script's output (or the caller waits for it).
bg() { setsid -f runuser -u "$name" -- bash -c ". $home/.k4env; exec $1" </dev/null >>"$home/.k4-$2.log" 2>&1 9>&-; }
up() { as pgrep -u "$name" -f "$1" >/dev/null 2>&1; }

if ! up "Xvfb :$n "; then
	setsid -f runuser -u "$name" -- Xvfb ":$n" -screen 0 1280x800x24 -nolisten tcp </dev/null >/dev/null 2>&1 9>&-
	for _ in $(seq 1 50); do [ -S "/tmp/.X11-unix/X$n" ] && break; sleep 0.1; done
	# A fresh D-Bus session per X server: XFCE, apps and Cua Driver all join it.
	as env DISPLAY=":$n" dbus-launch --sh-syntax </dev/null >"$state/.bus-$n" 2>/dev/null 9>&-
	bus=$(grep DBUS_SESSION_BUS_ADDRESS "$state/.bus-$n")
	cat >"$home/.k4env" <<EOF
export DISPLAY=:$n
$bus
export PATH=/usr/local/bin:/usr/bin:/bin
export BU_CDP_URL=http://127.0.0.1:$((9222 + n)) BU_NAME=$name BROWSER_USE_NO_UPDATE_CHECK=1 ANONYMIZED_TELEMETRY=false BH_TAB_MARKER=0
export HOME=$home USER=$name
cd $home
EOF
	chown "$name:$name" "$home/.k4env"
fi
up "xfce4-session" || bg "startxfce4" xfce
up "x11vnc -display :$n " || bg "x11vnc -display :$n -forever -shared -wait 50 -rfbport $((5900 + n)) -usepw" vnc
up "remote-debugging-port=$((9222 + n))" ||
	bg "google-chrome --remote-debugging-port=$((9222 + n)) --user-data-dir=$home/.chrome-agent --password-store=basic --no-first-run --no-default-browser-check --start-maximized about:blank" chrome
up "cua-driver serve" || bg "cua-driver serve" driver

for _ in $(seq 1 120); do
	curl -sf -o /dev/null "http://127.0.0.1:$((9222 + n))/json/version" &&
		[ -S "$home/.cache/cua-driver/cua-driver.sock" ] &&
		ss -ltn | grep -q ":$((5900 + n)) " && { echo "$n"; exit 0; }
	sleep 0.5
done
echo "Agent desktop $n did not come up; see $home/.k4-*.log" >&2
exit 4
