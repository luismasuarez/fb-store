#!/usr/bin/env bash
set -euo pipefail

SHORT_NAME=""
USE_TIMESTAMP=false
JSON=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=true; shift ;;
    --short-name) SHORT_NAME="$2"; shift 2 ;;
    --timestamp) USE_TIMESTAMP=true; shift ;;
    --number) shift ;; # ignored — script determines automatically
    *) shift ;; # skip positional description
  esac
done

if [ -z "$SHORT_NAME" ]; then
  echo '{"error":"--short-name is required"}'
  exit 1
fi

# Determine numbering mode
MODE="sequential"
if [ -f ".specify/extensions/git/git-config.yml" ]; then
  CFG_MODE=$(grep "branch_numbering:" .specify/extensions/git/git-config.yml 2>/dev/null | awk '{print $2}')
  [ -n "$CFG_MODE" ] && MODE="$CFG_MODE"
fi
if [ "$MODE" = "sequential" ] && [ -f ".specify/init-options.json" ]; then
  CFG_MODE=$(grep '"feature_numbering"' .specify/init-options.json 2>/dev/null | sed 's/.*: *"//;s/".*//')
  [ -n "$CFG_MODE" ] && MODE="$CFG_MODE"
fi

if [ "$MODE" = "timestamp" ] || [ "$USE_TIMESTAMP" = true ]; then
  FEATURE_NUM=$(date +"%Y%m%d-%H%M%S")
else
  LAST=$(git branch --list | grep -oE '^[0-9]+' | sort -n | tail -1)
  NEXT=$((LAST + 1))
  FEATURE_NUM=$(printf "%03d" "$NEXT")
fi

BRANCH_NAME="${FEATURE_NUM}-${SHORT_NAME}"

# Create and switch to branch if it doesn't exist
if ! git rev-parse --verify "$BRANCH_NAME" 2>/dev/null; then
  git checkout -b "$BRANCH_NAME"
fi

echo "{\"BRANCH_NAME\":\"$BRANCH_NAME\",\"FEATURE_NUM\":\"$FEATURE_NUM\"}"
