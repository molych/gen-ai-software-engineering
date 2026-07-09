"""Validation stage: checks required fields, amount, currency, timestamp,
and transaction type before a transaction is allowed further into the
pipeline. See specification.md ("Validation Stage") for the full contract.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

if __package__ in (None, ""):
    # Allow `python pipeline/validator.py` to work by putting the project
    # root (parent of this file's directory) on sys.path.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from pipeline.common import audit_log, sanitize_for_storage
    from pipeline.currency_codes import is_valid_currency
else:
    from .common import audit_log, sanitize_for_storage
    from .currency_codes import is_valid_currency

REQUIRED_FIELDS = (
    "transaction_id",
    "timestamp",
    "source_account",
    "destination_account",
    "amount",
    "currency",
    "transaction_type",
)

ALLOWED_TRANSACTION_TYPES = frozenset({"transfer", "wire_transfer", "refund"})


def _parse_timestamp(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except (TypeError, ValueError):
        return False


def process_transaction(record: dict) -> dict:
    """Validate a raw transaction record.

    Returns {'transaction_id', 'status': 'validated'|'rejected',
    'reason': str|None, 'data': dict}. Checks run in order and the first
    failure short-circuits, so each rejection has exactly one reason. The
    returned `data` always has account references masked and the
    `description` field dropped.
    """
    transaction_id = record.get("transaction_id")
    data = sanitize_for_storage(record)

    missing = [field for field in REQUIRED_FIELDS if not record.get(field)]
    if missing:
        reason = f"missing_required_field:{','.join(missing)}"
        audit_log("validator", transaction_id or "UNKNOWN", "rejected", {"reason": reason})
        return {"transaction_id": transaction_id, "status": "rejected", "reason": reason, "data": data}

    try:
        amount = Decimal(str(record["amount"]))
    except (InvalidOperation, ValueError, TypeError):
        reason = "amount_not_numeric"
        audit_log("validator", transaction_id, "rejected", {"reason": reason})
        return {"transaction_id": transaction_id, "status": "rejected", "reason": reason, "data": data}

    if amount <= 0:
        reason = "amount_must_be_positive"
        audit_log("validator", transaction_id, "rejected", {"reason": reason})
        return {"transaction_id": transaction_id, "status": "rejected", "reason": reason, "data": data}

    currency = record["currency"]
    if not is_valid_currency(currency):
        reason = f"invalid_currency_code:{currency}"
        audit_log("validator", transaction_id, "rejected", {"reason": reason})
        return {"transaction_id": transaction_id, "status": "rejected", "reason": reason, "data": data}

    if not _parse_timestamp(record["timestamp"]):
        reason = "invalid_timestamp"
        audit_log("validator", transaction_id, "rejected", {"reason": reason})
        return {"transaction_id": transaction_id, "status": "rejected", "reason": reason, "data": data}

    transaction_type = record["transaction_type"]
    if transaction_type not in ALLOWED_TRANSACTION_TYPES:
        reason = f"unsupported_transaction_type:{transaction_type}"
        audit_log("validator", transaction_id, "rejected", {"reason": reason})
        return {"transaction_id": transaction_id, "status": "rejected", "reason": reason, "data": data}

    data["amount"] = str(amount)
    audit_log("validator", transaction_id, "validated")
    return {"transaction_id": transaction_id, "status": "validated", "reason": None, "data": data}


def _run_dry_run(input_path: Path) -> None:
    records = json.loads(input_path.read_text(encoding="utf-8"))
    results = [process_transaction(record) for record in records]

    valid = [r for r in results if r["status"] == "validated"]
    invalid = [r for r in results if r["status"] == "rejected"]

    print(f"Total transactions:   {len(results)}")
    print(f"Valid:                {len(valid)}")
    print(f"Invalid:              {len(invalid)}")
    print()
    print(f"{'transaction_id':<12} {'status':<10} reason")
    print("-" * 60)
    for result in results:
        print(f"{result['transaction_id']:<12} {result['status']:<10} {result['reason'] or '-'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate transactions without running the full pipeline.")
    parser.add_argument("--input", default="sample-transactions.json", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Validate only, no shared/ writes.")
    args = parser.parse_args()

    if args.dry_run:
        _run_dry_run(args.input)
    else:
        _run_dry_run(args.input)


if __name__ == "__main__":
    main()
