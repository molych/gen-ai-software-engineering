# Agents Manual — Transaction Processing Pipeline

This document extends the course's generic "four agents" workflow (specification, code generation, unit tests, documentation) with the project-specific context an AI coding agent needs before touching this codebase. Read this together with `specification.md` before implementing or modifying any pipeline stage.

## 1. Mission & boundaries

The mission is to implement exactly the pipeline described in `specification.md`: a 4-stage transaction processor (Validation → Fraud Detection → Compliance Check → Settlement) that reads `sample-transactions.json`, passes records through `shared/` directories as JSON messages, and lands final outcomes in `shared/results/`. Do not add scope beyond the spec — no authorization/ledger/KYC subsystems, no persistence layer beyond flat JSON files, no authentication on the front-end. If a requirement is ambiguous, resolve it the way this document resolves it (see §7) rather than inventing new behavior silently.

## 2. Tech-stack assumptions

- Python 3.11+ (developed against 3.14), project-local `.venv/`.
- Flask for the front-end (`frontend/app.py`), server-rendered Jinja templates — no build step, no JS framework.
- `pytest` + `pytest-cov` for tests and the coverage gate.
- `fastmcp` for the custom MCP server (`mcp/server.py`), matching the decorator pattern already proven in this repo's homework-5 (`@mcp.tool(name=...)`, `@mcp.resource("scheme://path")`, `mcp.run()` under stdio).
- The stack itself is swappable per TASKS.md's language-agnostic framing; the domain rules in §3 are not.

## 3. Domain rules (non-negotiable)

1. **Money is always `decimal.Decimal`**, parsed as `Decimal(str(amount))` from the JSON string field. Never `float` — floating point cannot represent monetary values exactly and this is a graded requirement.
2. **Currency must validate against ISO 4217** via the static allow-list in `pipeline/currency_codes.py`. No network calls for validation — keeps the pipeline deterministic and testable offline.
3. **Amounts must be strictly positive.** This project does not overload sign to encode transaction direction — a `refund` is a positive-amount, `refund`-typed transaction, not a negative-amount `transfer`. (Resolves the `TXN007` ambiguity in `sample-transactions.json`, which has a negative amount; it is rejected by validation like any other negative amount, regardless of `transaction_type`.)
4. **No PII in logs or `shared/` JSON beyond masked account references.** Never log `source_account`/`destination_account` unmasked — use `mask_account()` (e.g. `ACC-1001` → `ACC-**01`). Never log the free-text `description` field at all.
5. **Every stage writes one audit log line per transaction**: ISO-8601 UTC timestamp, stage name, transaction ID, outcome — format `f"{iso_ts} stage={stage} txn={txn_id} outcome={outcome}"`.
6. **Stage functions are pure.** Each stage module exposes a single `process_transaction(record: dict) -> dict` with no file I/O — `orchestrator.py` owns all reads/writes under `shared/`. This is what keeps unit tests filesystem-free (no `shared/` fixtures needed for stage-level tests, only for the orchestrator integration test).

## 4. Code style

- One `process_transaction(record: dict) -> dict` per stage module (`pipeline/validator.py`, `fraud_detector.py`, `compliance_checker.py`, `settlement_processor.py`).
- Shared helpers (envelope construction, timestamps, masking, audit logging, atomic JSON writes) live once in `pipeline/common.py` — do not re-implement per stage.
- The ISO 4217 list lives once in `pipeline/currency_codes.py` — do not re-embed it per file.
- Prefer plain functions and dicts over classes; the pipeline stages have no shared mutable state.

## 5. Testing / verification

- Unit tests per stage (`tests/test_validator.py`, etc.) plus one integration test (`tests/test_orchestrator_integration.py`) driving the full pipeline end to end.
- Isolate every test from the real `shared/` directory using pytest's `tmp_path` fixture (see `tests/conftest.py`'s `tmp_shared` fixture) — tests must never read or write the project's real `shared/` contents.
- Coverage gate: **hard floor 80%**, enforced by a pre-push hook (`.claude/hooks/check-coverage.sh`) that blocks `git push` if `pytest --cov=pipeline --cov-fail-under=80` fails. Target ≥ 90%.
- Because the 8 records in `sample-transactions.json` don't exercise every branch (no sample hits missing-field, non-numeric-amount, malformed-timestamp, unsupported-type, or restricted-country paths), tests must add synthetic fixtures for those branches to reach the coverage target — don't skip them just because no sample data triggers them.

## 6. Security / compliance

- No secrets committed. `mcp.json`/`.mcp.json` may reference environment variables for API keys but must never inline them.
- PII handling per §3.4 applies everywhere transaction records are logged or displayed, including the Flask front-end and MCP server responses — masked account references only, never raw account numbers.

## 7. Edge-case handling

- Negative or zero amounts: always rejected by validation (§3.3), independent of `transaction_type`.
- Unknown or missing `metadata.country`: never triggers the cross-border fraud flag (fail-safe on the "flag" side — absence of data should not manufacture a risk signal) but also never blocks settlement on its own.
- Malformed/missing `metadata` entirely: treated as "no risk signals from metadata," not as a validation failure — `metadata` is optional context, not a required field.
- Restricted-country holds in compliance checking use an empty allow-list against the current sample data (no sample transaction touches a restricted country) — this branch is covered only via a synthetic test fixture, not live sample data.

## 8. Workflow conventions

- Do not `git commit` or `git push` unless explicitly asked.
- Build and verify one pipeline stage at a time before moving to the next (validator → fraud detector → compliance checker → settlement), matching `specification.md`'s Low-Level Tasks order.
- Always run `pytest --cov=pipeline` locally before attempting any push — the coverage-gate hook will block a push below 80% anyway, but don't rely on the hook as the first line of feedback.
- When context7 is used during code generation (Task 2/Task 4), document every query in `research-notes.md` with the search term, the library ID returned, and the concrete pattern applied — don't fabricate entries for queries that weren't actually run.

## 9. Definition of Done

A stage or feature is done when:
- It satisfies the relevant Mid-Level Objective(s) in `specification.md`.
- It has unit test coverage for its normal path and its documented edge cases.
- It introduces no PII into logs or persisted JSON.
- `pytest --cov=pipeline --cov-report=term-missing` does not regress below the current coverage level.
- It has not been committed or pushed unless the user explicitly asked for that.
