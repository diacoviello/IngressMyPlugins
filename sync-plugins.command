#!/usr/bin/env bash
# sync-plugins.command — double-clickable launcher for sync-plugins.sh (macOS Finder).
# Double-click this file in Finder to commit & push your plugin changes. The
# Terminal window stays open afterward so you can read the result.
cd "$(dirname "$0")" || exit 1
./sync-plugins.sh "$@"
status=$?
echo ""
echo "Finished (exit $status). Press any key to close this window."
read -n 1 -s
