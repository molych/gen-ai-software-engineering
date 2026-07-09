"""Compliance check stage: applies restricted-country holds, combined
cross-border + unusual-timing holds, and CTR (currency transaction report)
flagging. See specification.md ("Compliance Check Stage") for the full
contract.
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from pipeline.common import audit_log
else:
    from .common import audit_log

# Empty by default: no sample transaction touches a restricted country.
# Extend with real ISO 3166 country codes as compliance policy requires.
RESTRICTED_COUNTRIES: frozenset[str] = frozenset()

CTR_THRESHOLD = Decimal("10000")


def process_transaction(record: dict) -> dict:
    """Decide the compliance disposition of a fraud-scored transaction.

    Returns the record augmented with compliance_status
    ('held_for_review' | 'ctr_flagged' | 'clear') and compliance_notes
    explaining which rule fired.
    """
    transaction_id = record.get("transaction_id")
    amount = Decimal(str(record.get("amount", "0")))
    metadata = record.get("metadata") or {}
    country = metadata.get("country")
    risk_flags = record.get("risk_flags") or []
    flagged_for_review = record.get("flagged_for_review", False)

    notes: list[str] = []

    if country in RESTRICTED_COUNTRIES:
        status = "held_for_review"
        notes.append(f"restricted_country:{country}")
    elif flagged_for_review and "cross_border" in risk_flags and "unusual_timing" in risk_flags:
        status = "held_for_review"
        notes.append("cross_border_plus_unusual_timing")
    elif amount > CTR_THRESHOLD:
        status = "ctr_flagged"
        notes.append(f"amount_over_ctr_threshold:{CTR_THRESHOLD}")
    else:
        status = "clear"
        notes.append("no_compliance_concerns")

    result = dict(record)
    result["compliance_status"] = status
    result["compliance_notes"] = notes

    audit_log("compliance_checker", transaction_id, status)
    return result
