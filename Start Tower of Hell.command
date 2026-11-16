#!/bin/bash
# Double-click launcher: starts the local server and opens the game.
cd "$(dirname "$0")" || exit 1

NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  for cand in "$HOME"/.hermes/tools/node-*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$cand" ] && NODE="$cand" && break
  done
fi
if [ -z "$NODE" ]; then
  echo "Node.js not found. Install it from https://nodejs.org or run: brew install node"
  read -r -p "Press return to close."
  exit 1
fi

PORT="${PORT:-8911}"
if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "Already running on port $PORT."
else
  nohup "$NODE" server.mjs > data/server.log 2>&1 &
  echo "Starting server on port $PORT…"
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then break; fi
    sleep 0.25
  done
fi

open "http://127.0.0.1:$PORT/"
