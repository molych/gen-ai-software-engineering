#!/usr/bin/env bash
#
# Demo script — starts the Customer Support System API, fires a sequence of
# sample requests, then shuts the server down.
#
# Usage:  ./demo/run.sh
#
set -euo pipefail

# Resolve paths relative to this script so it runs from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BASE="http://localhost:${PORT:-3000}"

cd "$APP_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

echo "Starting API server..."
npm start >/tmp/css-demo-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Wait for the server to accept connections.
for _ in $(seq 1 30); do
  if curl -sf "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

hr() { printf '\n=== %s ===\n' "$1"; }

hr "Health check"
curl -s "$BASE/health"; echo

hr "Create a ticket with auto-classification"
CREATE=$(curl -s -X POST "$BASE/tickets?autoClassify=true" \
  -H 'Content-Type: application/json' \
  -d '{"customer_id":"CUST-1","customer_email":"demo@example.com","customer_name":"Demo User","subject":"Cannot access my account","description":"I cannot access my account, this is critical and production is down."}')
echo "$CREATE"
TICKET_ID=$(echo "$CREATE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

hr "Bulk import (JSON) with auto-classification"
curl -s -X POST "$BASE/tickets/import?autoClassify=true" \
  -H 'Content-Type: application/json' \
  --data @"$SCRIPT_DIR/sample-data.json"; echo

hr "List tickets (urgent only)"
curl -s "$BASE/tickets?priority=urgent"; echo

hr "Get the created ticket ($TICKET_ID)"
curl -s "$BASE/tickets/$TICKET_ID"; echo

hr "Update ticket -> resolved"
curl -s -X PUT "$BASE/tickets/$TICKET_ID" \
  -H 'Content-Type: application/json' -d '{"status":"resolved"}'; echo

hr "Validation error (expect 400)"
curl -s -X POST "$BASE/tickets" \
  -H 'Content-Type: application/json' -d '{"customer_email":"bad"}'; echo

hr "Delete the ticket (expect 204, no body)"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X DELETE "$BASE/tickets/$TICKET_ID"

echo
echo "Demo complete. Stopping server."
