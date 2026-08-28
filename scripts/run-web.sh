#!/usr/bin/env bash
# run-web.sh — Start Next.js UI (port 3350) and Hono API (port 3351)

echo "========================================="
echo "  Starting LIVE-ASSIST Web Platform v1  "
echo "  UI  : http://localhost:3350            "
echo "  API : http://localhost:3351            "
echo "  Tailscale: http://100.116.104.113:3350  "
echo "========================================="

# Start API in background
bun src/server/index.ts &
API_PID=$!

trap "kill $API_PID 2>/dev/null; exit" SIGINT SIGTERM EXIT

# Start Next.js dev server
bun run next dev -p 3350
