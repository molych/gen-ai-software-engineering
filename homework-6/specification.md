# Transaction Processing Pipeline Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.

## High-Level Objective

Process raw banking transactions from `sample-transactions.json` through a 4-stage pipeline (Validation → Fraud Detection → Compliance Check → Settlement) that rejects invalid records, scores risk, applies compliance holds, and settles cleared transactions, exposing results through a Flask dashboard and a FastMCP server.

## Mid-Level Objectives

- Transactions with `amount > $10,000` are flagged for fraud review and receive a numeric risk score (0-100+) built from high-value, cross-border, unusual-timing, and wire-transfer signals.
- Rejected transactions (failed validation) are written to `shared/results/<transaction_id>.json` with a `status: "rejected"` and a machine-readable `reason` field (e.g. `invalid_currency_code:XYZ`, `amount_must_be_positive`).
- Transactions that are both cross-border and occur during an unusual hour (00:00–06:00 UTC) are held for compliance review (`held_for_review`) even if their amount alone wouldn't trigger a hold.
- All four pipeline stages log one ISO-8601-timestamped audit line per transaction (stage name, transaction ID, outcome) without ever logging raw account numbers or free-text descriptions.
- Test coverage on `pipeline/` is ≥ 90% (hard gate enforced at 80% by a pre-push hook), covering every stage's normal path and documented edge cases.

## Implementation Notes

- **Monetary values**: use `decimal.Decimal`, parsed as `Decimal(str(amount))` from the JSON string field — never `float`. All arithmetic (threshold comparisons, settlement quantization) stays in `Decimal`.
- **Currency codes**: validate against ISO 4217 via a static allow-list in `pipeline/currency_codes.py` (`VALID_ISO4217_CODES`) — no network lookups, keeps the pipeline deterministic.
- **Amount sign**: amounts must be strictly positive regardless of `transaction_type`. A `refund` is a positive-amount `refund`-typed transaction; direction is conveyed by `transaction_type` and the account fields, not by sign. (Resolves the negative-amount case in `sample-transactions.json`, `TXN007`.)
- **Logging / audit trail**: every stage emits `f"{iso_ts} stage={stage} txn={transaction_id} outcome={outcome}"` via `pipeline.common.audit_log()`. Timestamps are ISO 8601 UTC (`Z` suffix).
- **PII**: `source_account` and `destination_account` are masked before ever appearing in a log line (`mask_account()`, e.g. `ACC-1001` → `ACC-**01`); the `description` field is never logged.
- **Stage purity**: each stage exposes one `process_transaction(record: dict) -> dict` with no file I/O. `orchestrator.py` owns all reads/writes under `shared/`.
- **Message envelope**: stages communicate via the standard envelope (see Context below) — `message_id` (uuid4), ISO-8601 `timestamp`, `source_stage`, `target_stage`, `message_type`, and a `data` payload carrying the evolving transaction record.

## Context

### Beginning context

- `sample-transactions.json` — 8 raw transaction records (fields: `transaction_id`, `timestamp`, `source_account`, `destination_account`, `amount` as a string, `currency`, `transaction_type`, `description`, `metadata.channel`, `metadata.country`).
- No pipeline code, tests, front-end, or MCP server exist yet.

### Ending context

- `pipeline/` — `common.py`, `currency_codes.py`, `validator.py`, `fraud_detector.py`, `compliance_checker.py`, `settlement_processor.py`, each with a pure `process_transaction()`.
- `orchestrator.py` — drives all 8 transactions through the 4 stages via `shared/{input,processing,output,results}/`.
- `shared/results/*.json` — one final record per transaction, plus `shared/results/_summary.json` (counts by outcome + rejection reasons).
- `frontend/` — a Flask app (`app.py` + `templates/index.html`) showing the dashboard and a "Run Pipeline" trigger.
- `mcp/server.py` — a FastMCP server exposing `get_transaction_status`, `list_pipeline_results`, and the `pipeline://summary` resource.
- `tests/` — unit tests per stage + one orchestrator integration test, coverage ≥ 90% on `pipeline/`.
- Given the 8 sample records, the expected final split is: **5 settled** (TXN001, TXN002, TXN003, TXN005, TXN008), **1 held for review** (TXN004), **2 rejected** (TXN006: invalid currency, TXN007: negative amount).

## Low-Level Tasks

### 1. Validation Stage

Task: Validation Stage
Prompt: "Create `pipeline/validator.py` exposing `process_transaction(record: dict) -> dict`. Check, in order (first failure short-circuits): required fields present (`transaction_id`, `timestamp`, `source_account`, `destination_account`, `amount`, `currency`, `transaction_type`); `amount` parses as `Decimal(str(amount))`; parsed amount is strictly `> 0`; `currency` is in `pipeline.currency_codes.VALID_ISO4217_CODES`; `timestamp` parses as a valid ISO-8601 datetime; `transaction_type` is one of `{transfer, wire_transfer, refund}`. Return `{'transaction_id', 'status': 'validated'|'rejected', 'reason': str|None, 'data': {...record with amount as a Decimal-normalized string...}}`. Also add an `if __name__ == '__main__':` CLI branch supporting `--dry-run` that loads `sample-transactions.json` directly, runs `process_transaction()` over every record with no `shared/` writes, and prints a total/valid/invalid table with reasons."
File to CREATE: `pipeline/validator.py`
Function to CREATE: `process_transaction(record: dict) -> dict`
Details: Order of checks matters (fields → amount parse/sign → currency → timestamp format → transaction_type allow-list) so each rejection has exactly one, deterministic reason. No file I/O inside `process_transaction` — orchestrator.py owns `shared/` writes. Audit-log the outcome via `pipeline.common.audit_log("validator", transaction_id, status)`.

### 2. Fraud Detection Stage

Task: Fraud Detection Stage
Prompt: "Create `pipeline/fraud_detector.py` exposing `process_transaction(record: dict) -> dict`. Using constants `HIGH_VALUE = Decimal('10000')`, `VERY_HIGH_VALUE = Decimal('50000')`, `HOME_COUNTRY = 'US'`, and an unusual-hour window of 00:00–06:00 UTC, compute a risk score: +40 if `amount > HIGH_VALUE` (flag `high_value`), +20 more if `amount > VERY_HIGH_VALUE` (flag `very_high_value`), +20 if `metadata.country` is present and not `HOME_COUNTRY` (flag `cross_border`), +20 if the transaction hour falls in [0, 6) UTC (flag `unusual_timing`), +10 if `transaction_type == 'wire_transfer'` (flag `wire_transfer`). Set `flagged_for_review = amount > HIGH_VALUE or risk_score >= 40`. Set `risk_level` to `high` (score ≥ 70), `medium` (40-69), or `low` (< 40). Return the record augmented with `risk_score`, `risk_level`, `risk_flags` (list), `flagged_for_review`."
File to CREATE: `pipeline/fraud_detector.py`
Function to CREATE: `process_transaction(record: dict) -> dict`
Details: Only runs on already-`validated` records. Absence of `metadata.country` must never itself add a risk flag (fail-safe on the "flag" side, not a validation failure). Audit-log `outcome=risk_level` per transaction.

### 3. Compliance Check Stage

Task: Compliance Check Stage 
Prompt: "Create `pipeline/compliance_checker.py` exposing `process_transaction(record: dict) -> dict`. Using a `RESTRICTED_COUNTRIES` frozenset (empty by default, extendable), decide `compliance_status`: `held_for_review` if `metadata.country` is in `RESTRICTED_COUNTRIES`; else `held_for_review` if `flagged_for_review` is true and both `cross_border` and `unusual_timing` are in `risk_flags`; else `ctr_flagged` if `amount > 10000`; else `clear`. Return the record augmented with `compliance_status` and a `compliance_notes` list explaining which rule fired."
File to CREATE: `pipeline/compliance_checker.py`
Function to CREATE: `process_transaction(record: dict) -> dict`
Details: Only runs on records that passed fraud detection. The combined cross-border + unusual-timing rule is what puts TXN004 into `held_for_review` even though its amount alone ($500) is far under the CTR threshold. Audit-log `outcome=compliance_status`.

### 4. Settlement Processing Stage

Task: Settlement Processing Stage
Prompt: "Create `pipeline/settlement_processor.py` exposing `process_transaction(record: dict) -> dict`. If `compliance_status` is `clear` or `ctr_flagged`, assign a new `settlement_id` (uuid4 string), set `settled_at` to the current ISO-8601 UTC timestamp, and `final_status = 'settled'`. If `compliance_status` is `held_for_review`, pass the record through unchanged except `final_status = 'held_for_review'` (no settlement fields set)."
File to CREATE: `pipeline/settlement_processor.py`
Function to CREATE: `process_transaction(record: dict) -> dict`
Details: This is the terminal stage for records that reach it — its output is exactly what `orchestrator.py` writes to `shared/results/<transaction_id>.json`. Audit-log `outcome=final_status`.
