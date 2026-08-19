#!/usr/bin/env bash
# Re-run the accesskey audit. Your last tracker went stale; this stops that.
# Usage: ./scan-accesskeys.sh [dir ...]   (defaults to current dir)
set -uo pipefail
DIRS=("${@:-.}")

echo "=== accesskey / accessKey / access_key declarations ==="
grep -rInE "access[_]?[Kk]ey" "${DIRS[@]}" \
  --include='*.js' --include='*.html' --exclude-dir=.git --exclude-dir=node_modules

echo
echo "=== bare key handlers (collide with plain typing) ==="
grep -rInE "\.key\s*===?\s*['\"]|keyCode\s*===?\s*[0-9]+|which\s*===?\s*[0-9]+" \
  "${DIRS[@]}" --include='*.js' --exclude-dir=.git --exclude-dir=node_modules

echo
echo "=== key tally (a-z 0-9) ==="
USED=$(grep -rhoIE "access[_]?[Kk]ey[\"']?\s*[:=]\s*[\"']([a-zA-Z0-9])[\"']" \
  "${DIRS[@]}" --include='*.js' --include='*.html' --exclude-dir=.git \
  | grep -oE "[\"'][a-zA-Z0-9][\"']$" | tr -d "\"'" | tr 'A-Z' 'a-z' | sort -u)
echo "USED:   $(echo "$USED" | tr '\n' ' ')"
FREE=""
for k in {a..z} {0..9}; do
  grep -qx "$k" <<< "$USED" || FREE="$FREE $k"
done
echo "UNUSED:$FREE"
echo
echo "NOTE: window.dialog() ignores an 'accesskey' option — any hit inside a"
echo "      window.dialog({...}) call is dead. Use IITC.toolbox.addButton()."
