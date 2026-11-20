#!/bin/bash
# Driftwave launcher for Linux. Run: ./start-driftwave-linux.sh  (keep the terminal open while listening)
cd "$(dirname "$0")/app" || exit 1
PORT=8517; while (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; do PORT=$((PORT+1)); done
echo; echo "  Driftwave is running at http://localhost:$PORT/"; echo "  Press Ctrl+C to quit."; echo
(sleep 1; xdg-open "http://localhost:$PORT/" >/dev/null 2>&1) &
exec python3 -m http.server $PORT --bind 127.0.0.1
