#!/bin/bash
# Driftwave launcher for macOS: double-click in Finder. Keep the window open while listening.
cd "$(dirname "$0")/app" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is needed. macOS will offer to install it (Command Line Tools) — accept, then double-click again."
  python3 --version; read -p "Press Enter to close"; exit 1
fi
PORT=8517; while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo; echo "  Driftwave is running at http://localhost:$PORT/"; echo "  Close this window to quit."; echo
(sleep 1; open "http://localhost:$PORT/") &
exec python3 -m http.server $PORT --bind 127.0.0.1
