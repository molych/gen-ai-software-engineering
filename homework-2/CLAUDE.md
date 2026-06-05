# CLAUDE.md — Homework 2

This file is auto-loaded when working inside `homework-2/`. It is the persistent
**Context** layer of the Context-Model-Prompt framework this assignment is graded on.
The root `CLAUDE.md` (repo conventions + submission workflow) still applies — do not
duplicate it here.

Assignment: **Intelligent Customer Support System** — see `TASKS.md` for the full
brief. `TASKS.md` is the instructor's spec; treat it as read-only.

## Stack & layout

- **Node.js + Express**, JavaScript. Tests with **Jest** (`jest --coverage`).
- Suggested parsers: `csv-parse`, `fast-xml-parser`; JSON via stdlib.
- All code under `homework-2/src/`; tests under `homework-2/tests/`.
- Expected test files (from `TASKS.md` Task 3):
  `test_ticket_api`, `test_ticket_model`, `test_import_csv`, `test_import_json`,
  `test_import_xml`, `test_categorization`, `test_integration`, `test_performance`,
  plus `tests/fixtures/` for sample data.

## Ticket model (enums are closed sets — validate against them)

| Field | Rule |
|-------|------|
| `id` | UUID |
| `customer_email` | valid email |
| `subject` | string, 1–200 chars |
| `description` | string, 10–2000 chars |
| `category` | `account_access` \| `technical_issue` \| `billing_question` \| `feature_request` \| `bug_report` \| `other` |
| `priority` | `urgent` \| `high` \| `medium` \| `low` |
| `status` | `new` \| `in_progress` \| `waiting_customer` \| `resolved` \| `closed` |
| `metadata.source` | `web_form` \| `email` \| `api` \| `chat` \| `phone` |
| `metadata.device_type` | `desktop` \| `mobile` \| `tablet` |

`created_at` / `updated_at` are datetimes; `resolved_at` and `assigned_to` are nullable;
`tags` is an array.

## Auto-classification rules (Task 2 — implement these verbatim)

**Categories** — match on intent:
- `account_access` — login, password, 2FA issues
- `technical_issue` — bugs, errors, crashes
- `billing_question` — payments, invoices, refunds
- `feature_request` — enhancements, suggestions
- `bug_report` — defects with reproduction steps
- `other` — uncategorizable

**Priority** — keyword-driven, first match wins:
- `urgent` — "can't access", "critical", "production down", "security"
- `high` — "important", "blocking", "asap"
- `low` — "minor", "cosmetic", "suggestion"
- `medium` — default when nothing else matches

Classification responses must include: `category`, `priority`, `confidence` (0–1),
`reasoning`, and the `keywords` found. Auto-run is optional on creation; manual
override must be allowed; log every decision.

## Definition of done

- **Test coverage > 85% overall** — this is a hard gate (use `/coverage-gate`).
- Import handles **CSV, JSON, and XML**; bulk import returns a summary
  (total / successful / failed-with-errors); malformed files fail gracefully.
- HTTP status codes used correctly (201, 400, 404, …).
- Fixtures: `sample_tickets.csv` (50), `sample_tickets.json` (20),
  `sample_tickets.xml` (30), plus invalid-data files for negative tests.
- Four docs with **≥3 Mermaid diagrams total**: `README.md`, `API_REFERENCE.md`,
  `ARCHITECTURE.md`, `TESTING_GUIDE.md`.
- Coverage screenshot at `docs/screenshots/test_coverage.png`.

## Run / test commands

Fill in once `package.json` exists (expected: `npm start`, `npm test`,
`npm test -- --coverage`). `HOWTORUN.md` must end up with the concrete commands.
