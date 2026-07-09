Validate all transactions in `sample-transactions.json` without processing them.

Steps:
1. Run the validator stage in dry-run mode: `python pipeline/validator.py --dry-run` (activate `.venv` first if it exists: `source .venv/bin/activate`).
2. Report: total count, valid count, invalid count, and the reason for each rejection.
3. Show the table of results the command prints (`transaction_id`, `status`, `reason`).
