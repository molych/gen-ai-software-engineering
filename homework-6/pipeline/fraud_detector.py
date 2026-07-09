"""Fraud detection stage: scores validated transactions for risk based on
value, cross-border activity, unusual timing, and transfer method. See
specification.md ("Fraud Detection Stage") for the full contract.
"""

from __future__ import annotations

import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from pipeline.common import audit_log
else:
    from .common import audit_log

HIGH_VALUE = Decimal("10000")
VERY_HIGH_VALUE = Decimal("50000")
HOME_COUNTRY = "US"
UNUSUAL_HOUR_START = 0
UNUSUAL_HOUR_END = 6  # [0, 6) UTC


def _parse_hour(timestamp: str) -> int | None:
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        return dt.hour
    except (TypeError, ValueError):
        return None


def process_transaction(record: dict) -> dict:
    """Score a validated transaction for fraud risk.

    Returns the record augmented with risk_score, risk_level, risk_flags,
    and flagged_for_review. Expects a `data` dict as produced by
    pipeline.validator.process_transaction (transaction_id, amount as a
    Decimal-normalized string, currency, timestamp, transaction_type,
    metadata).
    """
    transaction_id = record.get("transaction_id")
    amount = Decimal(str(record.get("amount", "0")))
    metadata = record.get("metadata") or {}
    country = metadata.get("country")
    transaction_type = record.get("transaction_type")

    risk_score = 0
    risk_flags: list[str] = []

    if amount > HIGH_VALUE:
        risk_score += 40
        risk_flags.append("high_value")
        if amount > VERY_HIGH_VALUE:
            risk_score += 20
            risk_flags.append("very_high_value")

    if country and country != HOME_COUNTRY:
        risk_score += 20
        risk_flags.append("cross_border")

    hour = _parse_hour(record.get("timestamp", ""))
    if hour is not None and UNUSUAL_HOUR_START <= hour < UNUSUAL_HOUR_END:
        risk_score += 20
        risk_flags.append("unusual_timing")

    if transaction_type == "wire_transfer":
        risk_score += 10
        risk_flags.append("wire_transfer")

    flagged_for_review = amount > HIGH_VALUE or risk_score >= 40

    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"

    result = dict(record)
    result.update({
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_flags": risk_flags,
        "flagged_for_review": flagged_for_review,
    })

    audit_log("fraud_detector", transaction_id, risk_level, {"risk_score": risk_score})
    return result
