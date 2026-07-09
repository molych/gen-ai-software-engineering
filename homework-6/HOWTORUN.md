# How To Run

All commands below assume your current directory is `homework-6/`.

## 1. Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Run the pipeline

```bash
source .venv/bin/activate
python orchestrator.py
```

This loads `sample-transactions.json`, runs all 8 transactions through Validation → Fraud Detection → Compliance Check → Settlement, and writes one JSON file per transaction plus `shared/results/_summary.json`. Expected split: **5 settled, 1 held for review, 2 rejected**.

To start from a clean slate, delete the contents of `shared/{input,processing,output,results}/` first (the `/run-pipeline` skill does this automatically — see step 6).

## 3. Validate transactions without running the full pipeline

```bash
source .venv/bin/activate
python pipeline/validator.py --dry-run
```

Prints a total/valid/invalid table with rejection reasons, without touching `shared/`.

## 4. Run the front-end

```bash
source .venv/bin/activate
python frontend/app.py
```

Open http://127.0.0.1:5000/ — it shows the latest `shared/results/` state (counts + per-transaction table) and has a "Run Pipeline" button that re-runs the pipeline and refreshes the page.

## 5. Run the tests / coverage

```bash
source .venv/bin/activate
python -m pytest --cov=pipeline --cov-report=term-missing
```

Current coverage: **95%+ on `pipeline/`** (gate is 80%, enforced by the pre-push hook — see step 7).

## 6. Use the Claude Code skills

From inside a Claude Code session in `homework-6/`:

- `/write-spec` — (re)generates `specification.md` from `TASKS.md`/`agents.md`/`sample-transactions.json`.
- `/run-pipeline` — clears `shared/`, runs `python orchestrator.py`, and reports the summary + rejections.
- `/validate-transactions` — runs `python pipeline/validator.py --dry-run` and reports the results table.

## 7. Coverage-gate hook

`.claude/hooks/check-coverage.sh` is wired up as a `PreToolUse` hook on the `Bash` matcher in `.claude/settings.json`. It only acts on `git push` commands: it runs `pytest --cov=pipeline --cov-fail-under=80` and blocks the push (exit code 2, with a `systemMessage` explaining the failure) if coverage is below 80%.

**Hook configuration is loaded when a Claude Code session starts.** If you edit `.claude/settings.json` or the hook script, restart Claude Code (exit and run `claude` again from `homework-6/`) and confirm the hook is registered with the `/hooks` command before relying on it.

## 8. MCP servers

`mcp.json` (and its auto-loaded copy `.mcp.json`) configure two servers:

- `context7` — general library/documentation lookups (`npx -y @upstash/context7-mcp@latest`).
- `pipeline-status` — this project's custom FastMCP server (`mcp/server.py`), exposing:
  - Tool `get_transaction_status(transaction_id)` — current status of one transaction from `shared/results/`.
  - Tool `list_pipeline_results()` — summary of every processed transaction.
  - Resource `pipeline://summary` — the latest `shared/results/_summary.json` as text.

**MCP servers are also loaded at session start.** After `mcp.json`/`.mcp.json` changes, restart Claude Code from `homework-6/` and verify both servers are connected (e.g. via `/mcp` or by checking available tools) before querying them. `research-notes.md` documents the context7 queries made during development; if it still shows `TODO` placeholders, run the two listed queries in a live session and fill them in.

You can also run the custom MCP server standalone to sanity-check it starts cleanly:

```bash
source .venv/bin/activate
python mcp/server.py
```

(It will sit waiting for stdio input — press Ctrl+C to stop.)
