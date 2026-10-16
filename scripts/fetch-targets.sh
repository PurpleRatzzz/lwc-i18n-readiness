#!/usr/bin/env bash
# Clone every repo in targets.json into .targets/<name>, checked out at its pinned commit.
# Pinning matters: scan results and the eval gold set are only comparable on the same commit.
set -euo pipefail
cd "$(dirname "$0")/.."

node -e 'for (const [n, t] of Object.entries(require("./targets.json"))) console.log(n, t.url, t.sha)' |
while read -r name url sha; do
  dir=".targets/$name"
  if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" = "$sha" ]; then
    echo "$name: already at ${sha:0:7}"
    continue
  fi
  rm -rf "$dir"
  git init -q "$dir"
  git -C "$dir" fetch -q --depth 1 "$url" "$sha"
  git -C "$dir" -c advice.detachedHead=false checkout -q FETCH_HEAD
  echo "$name: fetched ${sha:0:7}"
done
