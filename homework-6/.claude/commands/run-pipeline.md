Run the transaction processing pipeline end-to-end.

Steps:
1. Check that `sample-transactions.json` exists in the project root.
2. Clear the `shared/` directories (`shared/input`, `shared/processing`, `shared/output`, `shared/results`) so the run starts from a clean state.
3. Run the pipeline: `python orchestrator.py` (activate `.venv` first if it exists: `source .venv/bin/activate`).
4. Show a summary of results from `shared/results/_summary.json` (total, settled, held for review, rejected).
5. Report any transactions that were rejected and why, using the `rejection_reasons` field in `shared/results/_summary.json`.
