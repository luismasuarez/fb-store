#!/usr/bin/env bash
set -euo pipefail

EVENT="${1:-unknown}"

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "[specify] Warning: Not a git repository; skipped auto-commit"
  exit 0
fi

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
  echo "[specify] No changes to commit; skipped auto-commit"
  exit 0
fi

# Determine commit message from config or use default
CONFIG_FILE=".specify/extensions/git/git-config.yml"
MESSAGE="[Spec Kit] Auto-commit ($EVENT)"

if [ -f "$CONFIG_FILE" ]; then
  # Try to extract per-event message from YAML using grep/sed
  CUSTOM_MSG=$(grep -A2 "after_${EVENT#after_}" "$CONFIG_FILE" 2>/dev/null | grep "message:" | sed 's/.*message: *//' | tr -d '"')
  if [ -n "$CUSTOM_MSG" ]; then
    MESSAGE="$CUSTOM_MSG"
  fi
fi

git add .
git commit -m "$MESSAGE"
echo "[specify] Auto-commit: $MESSAGE"
