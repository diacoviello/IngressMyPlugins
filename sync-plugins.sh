#!/usr/bin/env bash
# sync-plugins.sh — commit and push all IITC plugin changes to GitHub.
# Tampermonkey on every device then auto-updates from the @updateURL headers.
# Usage: ./sync-plugins.sh [optional commit message]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="main"
CUSTOM_MSG="${1:-}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$REPO_DIR"

echo "=== IITC Plugin Sync ==="
echo ""

# Warn about any .user.js files still missing @updateURL
MISSING_UPDATE_URL=()
while IFS= read -r -d '' f; do
  if ! grep -q "@updateURL" "$f"; then
    MISSING_UPDATE_URL+=("$f")
  fi
done < <(find myVersion -name "*.user.js" -print0 2>/dev/null)

if [ ${#MISSING_UPDATE_URL[@]} -gt 0 ]; then
  echo -e "${YELLOW}Warning: these plugins are missing @updateURL (won't auto-update on devices):${NC}"
  for f in "${MISSING_UPDATE_URL[@]}"; do
    echo "  - $f"
  done
  echo ""
fi

# Stage all plugin files
git add myVersion/*.user.js 2>/dev/null || true
# Include any root-level plugins too
git add *.user.js 2>/dev/null || true

# Check if anything changed
if git diff --cached --quiet; then
  echo -e "${GREEN}Nothing to commit — GitHub already has your latest plugins.${NC}"
  echo ""
  echo "Tip: force Tampermonkey to check for updates now via"
  echo "  Tampermonkey dashboard → ⟳ (check for updates)"
  exit 0
fi

# Build commit message
CHANGED_FILES=$(git diff --cached --name-only | grep "\.user\.js" || true)
CHANGED_COUNT=$(echo "$CHANGED_FILES" | grep -c "." || echo "0")
CHANGED_NAMES=$(echo "$CHANGED_FILES" | xargs -I{} basename {} .user.js | tr '\n' ', ' | sed 's/, $//')

if [ -n "$CUSTOM_MSG" ]; then
  COMMIT_MSG="$CUSTOM_MSG"
else
  COMMIT_MSG="sync: update $CHANGED_COUNT plugin(s) — $CHANGED_NAMES"
fi

echo "Committing $CHANGED_COUNT changed file(s):"
echo "$CHANGED_FILES" | sed 's/^/  /'
echo ""

git commit -m "$COMMIT_MSG"

echo ""
echo "Pushing to GitHub ($BRANCH)..."
git push origin "$BRANCH"

echo ""
echo -e "${GREEN}Done! All devices will auto-update next time Tampermonkey checks.${NC}"
echo ""
echo "To force an immediate update on any device:"
echo "  Tampermonkey dashboard → Utilities → Check for userscript updates"
echo ""
echo "To install plugins on a new device, open install.html in your browser."
