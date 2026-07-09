# Homework 6: AI-Powered Transaction Processing Pipeline (Capstone)

**Author:** Oleksandr Mochalov ([@molych](https://github.com/molych))

## Overview

This project is a capstone transaction-processing pipeline built with heavy use of Claude Code's workflow tooling: a slash-command skill generates the technical specification, the pipeline code was generated with context7-assisted lookups, a coverage-gated hook protects `git push`, and a custom FastMCP server exposes pipeline results as queryable tools/resources.

The pipeline itself reads raw banking transactions from `sample-transactions.json` and runs each one through four stages — Validation, Fraud Detection, Compliance Check, and Settlement — communicating between stages as JSON messages through a `shared/{input,processing,output,results}/` directory protocol. Rejected, held, and settled outcomes all land in `shared/results/`, along with a `_summary.json` report. A Flask dashboard and a FastMCP server both read from that same `shared/results/` state, so the pipeline, the web UI, and Claude (via MCP) always agree on the current status of every transaction.

## Pipeline Stage Responsibilities

- **Validation** (`pipeline/validator.py`) — checks required fields, parses `amount` as `Decimal`, rejects non-positive amounts, validates the currency against an ISO 4217 allow-list, checks the timestamp format, and checks `transaction_type` against an allow-list. Rejects with a specific machine-readable `reason` on the first failing check.
- **Fraud Detection** (`pipeline/fraud_detector.py`) — scores every validated transaction for risk (high-value, very-high-value, cross-border, unusual timing, wire transfer), producing a `risk_score`, `risk_level`, and `flagged_for_review` flag.
- **Compliance Check** (`pipeline/compliance_checker.py`) — applies restricted-country holds, holds transactions that are both cross-border and occur at an unusual hour, and flags high-value transactions for CTR reporting.
- **Settlement** (`pipeline/settlement_processor.py`) — settles cleared/CTR-flagged transactions with a `settlement_id` and timestamp; passes held transactions through unsettled.
- **Orchestrator** (`orchestrator.py`) — drives all 4 stages for every transaction through the `shared/` file protocol and writes the final per-transaction and summary reports.

## Architecture

```
                     sample-transactions.json
                              │
                              ▼
                    ┌──────────────────┐
                    │   orchestrator   │
                    └────────┬─────────┘
                             │  shared/input/ → shared/processing/ → shared/output/
                             ▼
                    ┌──────────────────┐
                    │    Validator     │──reject──► shared/results/<id>.json (rejected)
                    └────────┬─────────┘
                             │ validated
                             ▼
                    ┌──────────────────┐
                    │  Fraud Detector  │
                    └────────┬─────────┘
                             │ risk-scored
                             ▼
                    ┌──────────────────┐
                    │Compliance Checker│──held─────► shared/results/<id>.json (held_for_review)
                    └────────┬─────────┘
                             │ clear / ctr_flagged
                             ▼
                    ┌──────────────────┐
                    │Settlement Process│────────────► shared/results/<id>.json (settled)
                    └──────────────────┘
                             │
                             ▼
                  shared/results/_summary.json
                    │                    │
                    ▼                    ▼
          Flask dashboard         FastMCP server
          (frontend/app.py)       (mcp/server.py)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Pipeline / orchestrator | Standard library (`decimal`, `json`, `pathlib`, `logging`) |
| Front-end | Flask + Jinja templates |
| Tests | pytest + pytest-cov |
| Custom MCP server | FastMCP (stdio transport) |
| Library docs during coding | context7 MCP server |
| Coverage gate | Claude Code `PreToolUse` hook on `Bash` (blocks `git push` below 80%) |

## Key Deliverables

- `specification.md` / `agents.md` — the technical spec and domain-rules manual (Task 1).
- `orchestrator.py`, `pipeline/*.py`, `frontend/` — the pipeline and its web dashboard (Task 2).
- `.claude/commands/*.md`, `.claude/hooks/check-coverage.sh`, `.claude/settings.json` — skills and the coverage-gate hook (Task 3).
- `mcp.json` / `.mcp.json`, `mcp/server.py`, `research-notes.md` — MCP integration (Task 4).
- `tests/`, this `README.md`, `HOWTORUN.md`, `docs/presentation.pdf` — tests and documentation (Task 5).

See `HOWTORUN.md` for exact setup, run, and test instructions.
