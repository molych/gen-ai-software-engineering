---
description: Generate or refresh the Homework 2 sample-data fixture files
argument-hint: "[valid|invalid|all]  (default: all)"
---

Generate the Homework 2 sample-data fixtures into `homework-2/tests/fixtures/`.
Scope from `$ARGUMENTS` (default `all`).

**Valid fixtures** — realistic support tickets matching the ticket model and enums
in `homework-2/CLAUDE.md`:
- `sample_tickets.csv` — 50 tickets
- `sample_tickets.json` — 20 tickets
- `sample_tickets.xml` — 30 tickets

Spread the data across all categories, priorities, statuses, sources, and device
types so import and classification tests have real variety.

**Invalid fixtures** — for negative tests, one failure mode per file, named clearly
(e.g. `invalid_missing_fields.csv`, `invalid_bad_email.json`, `malformed.xml`):
bad email format, subject/description length violations, unknown enum values,
missing required fields, and structurally malformed files.

Keep formats internally consistent (same logical columns/keys across CSV/JSON/XML)
so cross-format import tests can compare results.
