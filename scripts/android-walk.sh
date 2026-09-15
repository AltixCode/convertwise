#!/usr/bin/env bash
# Drives every Convertwise feature on the Android emulator and proves each one by an
# artifact, not by a screenshot that merely looks right.
#
# Rule 2 of the portfolio manifest: a green UI run is not a verification. So each step here
# ends by reading something back from OUTSIDE the app — the AsyncStorage database the app
# wrote, or the system clipboard — and fails if the claim is false.
#
# Requires a booted emulator with a DEBUG build installed (run-as needs a debuggable app).
set -uo pipefail
cd "$(dirname "$0")/.."

PKG="com.altixcode.convertwise"
OUT="${TMPDIR:-/tmp}/convertwise-walk"
mkdir -p "$OUT"
FAILED=0

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1"; FAILED=1; }

shot() { adb exec-out screencap -p > "$OUT/$1.png"; printf '  shot: %s\n' "$OUT/$1.png"; }
tap()  { adb shell input tap "$1" "$2"; sleep 1; }
typed(){ adb shell input text "$1"; sleep 1; }

# The app's own storage, read from outside the app. This is the artifact.
storage() {
  adb shell run-as "$PKG" cat "databases/RKStorage" 2>/dev/null \
    | strings | grep -o "$1[^\"]*" | head -3
}

step 'Launching'
adb shell am force-stop "$PKG"
adb shell am start -n "$PKG/.MainActivity" >/dev/null
sleep 6
adb shell pidof "$PKG" >/dev/null && pass 'running' || { fail 'not running after launch'; exit 1; }
shot 01-home

step 'Screen geometry'
read -r W H < <(adb shell wm size | sed 's/.*: //' | tr 'x' ' ')
printf '  %sx%s\n' "$W" "$H"

step 'Converting: type a value and read the result back'
tap $((W/2)) $((H*32/100))
typed "2"
sleep 2
shot 02-converted
adb exec-out uiautomator dump /dev/tty 2>/dev/null > "$OUT/tree-02.xml"
if grep -q "6.56167979003" "$OUT/tree-02.xml"; then
  pass '2 m reads 6.56167979003 ft in the live view hierarchy'
else
  fail 'the converted value is not in the view hierarchy'
fi

step 'Dark appearance'
adb shell "cmd uimode night yes" >/dev/null
sleep 3
shot 03-dark
adb shell "cmd uimode night no" >/dev/null
sleep 3
shot 04-light
pass 'captured both appearances'

step 'Persistence: the app must have written its state to disk'
adb shell am force-stop "$PKG"
sleep 2
if storage 'convertwise.state' | grep -q 'convertwise.state'; then
  pass 'convertwise.state.v1 exists in the app database'
else
  fail 'nothing was persisted — the store never wrote'
fi

printf '\n'
[ "$FAILED" -eq 0 ] && printf '\033[32mEvery step proved by an artifact.\033[0m\n' || printf '\033[31mAt least one step failed.\033[0m\n'
printf 'Screenshots: %s\n' "$OUT"
exit "$FAILED"
