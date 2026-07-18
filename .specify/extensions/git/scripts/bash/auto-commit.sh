#!/usr/bin/env bash
set -euo pipefail

EVENT="${1:-}"
if [ -z "$EVENT" ]; then
  echo "[git-extension] Error: no event name provided"
  exit 1
fi

CONFIG_FILE=".specify/extensions/git/git-config.yml"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[git-extension] Config not found at $CONFIG_FILE — skipping"
  exit 0
fi

# Check if git is available and we're in a repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "[git-extension] Not a git repository — skipping"
  exit 0
fi

# Check for uncommitted changes
if git diff --quiet && git diff --cached --quiet; then
  echo "[git-extension] No changes to commit — skipping"
  exit 0
fi

# Parse YAML block for a given event using awk
# Extracts the block under "auto_commit:" for the matching sub-key
parse_field() {
  local event="$1"
  local field="$2"
  awk -v e="$event" -v f="$field" '
    /^auto_commit:/ { in_block = 1; next }
    in_block && /^  [a-z]/ {
      # Track current sub-key
      if ($0 ~ /^  [a-zA-Z_-]+:$/) {
        current = $0
        gsub(/^  |:$/, "", current)
      }
      next
    }
    in_block && current == e && $0 ~ f":" {
      # Extract value after field:
      sub(/.*'$field':[[:space:]]*/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
    in_block && /^[a-zA-Z]/ && !/^  / { in_block = 0 }
  ' "$CONFIG_FILE"
}

is_enabled() {
  local val
  val=$(parse_field "$1" "enabled")
  if [ -z "$val" ]; then
    # Fall back to default
    val=$(awk '/^auto_commit:/ { in_block=1 } in_block && /default:/ { gsub(/.*default:[[:space:]]*/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print; exit }' "$CONFIG_FILE")
  fi
  [ "$val" = "true" ]
}

get_message() {
  local msg
  msg=$(parse_field "$1" "message")
  if [ -z "$msg" ]; then
    echo "[Spec Kit] Auto-commit ($EVENT)"
  else
    echo "$msg"
  fi
}

if is_enabled "$EVENT"; then
  MESSAGE=$(get_message "$EVENT")
  echo "[git-extension] Auto-committing after $EVENT..."
  git add .
  git commit -m "$MESSAGE"
  echo "[git-extension] Committed: $MESSAGE"
else
  echo "[git-extension] Auto-commit disabled for event: $EVENT"
fi
