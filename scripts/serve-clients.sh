#!/usr/bin/env bash
# Serve the three Angular client apps on distinct ports for local verification.
# Usage: bash scripts/serve-clients.sh   (Ctrl-C to stop all)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

declare -A PORTS=( [Landing]=4200 [Application]=4201 [Admin]=4202 )
pids=()

cleanup() { echo; echo "Stopping dev servers..."; for p in "${pids[@]}"; do kill "$p" 2>/dev/null; done; }
trap cleanup EXIT INT TERM

for app in Landing Application Admin; do
  dir="$ROOT/client/$app"
  port="${PORTS[$app]}"
  if [ ! -d "$dir/node_modules" ]; then
    echo "[$app] installing deps..."
    ( cd "$dir" && npm install --legacy-peer-deps --no-audit --no-fund )
  fi
  echo "[$app] ng serve on http://localhost:$port"
  ( cd "$dir" && npx ng serve --port "$port" ) &
  pids+=($!)
done

echo
echo "Landing      -> http://localhost:4200"
echo "Application  -> http://localhost:4201  (append /<tenantName> to log in)"
echo "Admin        -> http://localhost:4202"
echo "Press Ctrl-C to stop all."
wait
