#!/usr/bin/env bash
set -euo pipefail

EVENT="${1:-after_implement}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../../../git/git-config.yml"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[git-commit] Not a git repository — skipping"
  exit 0
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[git-commit] No git-config.yml found — skipping"
  exit 0
fi

# Parse YAML with grep/awk (no Ruby dependency)
ENABLED=$(grep -A2 "auto_commit:" "$CONFIG_FILE" | grep -E "$EVENT:" -A2 | grep "enabled:" | awk '{print $2}')
MESSAGE=$(grep -A2 "auto_commit:" "$CONFIG_FILE" | grep -E "$EVENT:" -A2 | grep "message:" | awk -F'"' '{print $2}')

if [ "$ENABLED" != "true" ]; then
  echo "[git-commit] auto_commit.$EVENT not enabled — skipping"
  exit 0
fi

if git diff --quiet && git diff --cached --quiet; then
  echo "[git-commit] No changes to commit — skipping"
  exit 0
fi

MESSAGE="${MESSAGE:-[Spec Kit] Auto-commit}"

git add .
git commit -m "$MESSAGE"
echo "[git-commit] Committed: $MESSAGE"
