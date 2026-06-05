# ▶️ How to Run — Intelligent Customer Support System

Step-by-step guide to run and test the Homework 2 application.

## Prerequisites

- **Node.js 18+** and **npm** (check with `node -v` && `npm -v`).
- No database or external service is required — the app uses an in-memory store.

## 1. Install dependencies

```bash
cd homework-2
npm install
```

## 2. Start the API

```bash
npm start
```

The server listens on **http://localhost:3000** (override with `PORT=4000 npm start`).
Use `npm run dev` to auto-restart on file changes.

Verify it is up:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"customer-support-system"}
```

## 3. Try the API

The quickest path is the demo script, which starts the server and fires a
sequence of sample requests:

```bash
./demo/run.sh
```

Or run individual calls — see `demo/sample-requests.http` (open in VS Code REST
Client / JetBrains HTTP client) or the cURL examples in `docs/API_REFERENCE.md`.

```bash
# Create a ticket with auto-classification
curl -X POST "http://localhost:3000/tickets?autoClassify=true" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"CUST-1","customer_email":"a@example.com","customer_name":"Ann",
       "subject":"Cannot login","description":"I cannot log in to my account, this is critical."}'

# List tickets, filtered
curl "http://localhost:3000/tickets?category=account_access&priority=urgent"
```

## 4. Run the tests

```bash
npm test                  # run all 190 tests across 8 suites
npm test -- --coverage    # run with the coverage report (>85% gate enforced)
npx jest tests/test_categorization.test.js   # run a single suite
```

The HTML coverage report is written to `coverage/lcov-report/index.html`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `EADDRINUSE` on start | Port 3000 is taken — run with `PORT=4000 npm start`. |
| `Cannot find module` | Run `npm install` inside `homework-2/`. |
| Coverage threshold failure | A test or source change dropped coverage below 85% — see the per-file table in the test output. |

See `README.md` for the project overview and `docs/` for the API, architecture,
and testing references.
