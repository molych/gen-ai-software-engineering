"""Shared pipeline utilities: message envelopes, timestamps, PII-safe audit
logging, and atomic JSON writes. Used by every stage module and by
orchestrator.py.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("pipeline.audit")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def now_iso8601() -> str:
    """Current UTC time as an ISO-8601 string with a trailing 'Z'."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_message(source_stage: str, target_stage: str, message_type: str, data: dict) -> dict:
    """Build the standard inter-stage message envelope (see specification.md)."""
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": now_iso8601(),
        "source_stage": source_stage,
        "target_stage": target_stage,
        "message_type": message_type,
        "data": data,
    }


_TRAILING_DIGITS_RE = re.compile(r"^(.*?)(\d+)$")


def mask_account(account: str | None) -> str:
    """Mask an account reference for safe logging/display.

    Keeps any non-numeric prefix and the last 2 digits, replacing the rest
    of the digit run with '*'. E.g. 'ACC-1001' -> 'ACC-**01'.
    """
    if not account:
        return account or ""
    match = _TRAILING_DIGITS_RE.match(account)
    if not match or len(match.group(2)) <= 2:
        return "*" * len(account)
    prefix, digits = match.groups()
    return f"{prefix}{'*' * (len(digits) - 2)}{digits[-2:]}"


def audit_log(stage: str, transaction_id: str, outcome: str, extra: dict | None = None) -> None:
    """Emit one PII-safe, ISO-8601-timestamped audit line for a stage's decision.

    Never pass raw account numbers or the free-text `description` field as
    `extra` — mask account references with mask_account() first if needed.
    """
    line = f"{now_iso8601()} stage={stage} txn={transaction_id} outcome={outcome}"
    if extra:
        line += " " + " ".join(f"{key}={value}" for key, value in extra.items())
    logger.info(line)


def sanitize_for_storage(record: dict) -> dict:
    """Mask account references and drop the free-text description field.

    Applied before any transaction data is written to a shared/ file or
    passed between stages, per the no-PII-beyond-masked-accounts domain
    rule (see agents.md).
    """
    sanitized = dict(record)
    if sanitized.get("source_account"):
        sanitized["source_account"] = mask_account(sanitized["source_account"])
    if sanitized.get("destination_account"):
        sanitized["destination_account"] = mask_account(sanitized["destination_account"])
    sanitized.pop("description", None)
    return sanitized


def write_json_atomic(path: Path | str, obj: dict) -> None:
    """Write `obj` as JSON to `path` atomically (temp file + os.replace)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, default=str)
    os.replace(tmp_path, path)
