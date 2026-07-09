"""Settlement processing stage: the terminal stage for transactions that
clear compliance. See specification.md ("Settlement Processing Stage") for
the full contract.
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from pipeline.common import audit_log, now_iso8601
else:
    from .common import audit_log, now_iso8601

SETTLEABLE_STATUSES = frozenset({"clear", "ctr_flagged"})


def process_transaction(record: dict) -> dict:
    """Settle a compliance-cleared transaction, or pass through a hold.

    Returns the record augmented with settlement_id/settled_at/final_status
    when compliance_status is 'clear' or 'ctr_flagged'; otherwise passes the
    record through unchanged with final_status='held_for_review'.
    """
    transaction_id = record.get("transaction_id")
    compliance_status = record.get("compliance_status")

    result = dict(record)

    if compliance_status in SETTLEABLE_STATUSES:
        result["settlement_id"] = str(uuid.uuid4())
        result["settled_at"] = now_iso8601()
        result["final_status"] = "settled"
    else:
        result["final_status"] = "held_for_review"

    audit_log("settlement_processor", transaction_id, result["final_status"])
    return result
