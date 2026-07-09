import json
import re
from datetime import datetime, timezone
from pathlib import Path

from pipeline import common


def test_now_iso8601_format_and_trailing_z():
    ts = common.now_iso8601()
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", ts)
    # round-trips through fromisoformat (with the Z swapped for +00:00)
    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    assert parsed.tzinfo == timezone.utc


def test_new_message_envelope_shape():
    msg = common.new_message("validator", "fraud_detector", "transaction", {"transaction_id": "TXN001"})
    assert msg["source_stage"] == "validator"
    assert msg["target_stage"] == "fraud_detector"
    assert msg["message_type"] == "transaction"
    assert msg["data"] == {"transaction_id": "TXN001"}
    assert msg["message_id"]
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", msg["timestamp"])


def test_new_message_ids_are_unique():
    first = common.new_message("a", "b", "transaction", {})
    second = common.new_message("a", "b", "transaction", {})
    assert first["message_id"] != second["message_id"]


def test_mask_account_none_returns_empty_string():
    assert common.mask_account(None) == ""


def test_mask_account_empty_string_returns_empty_string():
    assert common.mask_account("") == ""


def test_mask_account_masks_all_but_last_two_digits():
    assert common.mask_account("ACC-1001") == "ACC-**01"


def test_mask_account_short_digit_run_fully_masked():
    assert common.mask_account("ACC-1") == "*****"


def test_mask_account_no_trailing_digits_fully_masked():
    assert common.mask_account("ACCOUNT") == "*******"


def test_audit_log_emits_expected_line(caplog):
    with caplog.at_level("INFO", logger="pipeline.audit"):
        common.audit_log("validator", "TXN001", "validated")
    assert any("stage=validator txn=TXN001 outcome=validated" in r.message for r in caplog.records)


def test_audit_log_includes_extra_fields(caplog):
    with caplog.at_level("INFO", logger="pipeline.audit"):
        common.audit_log("fraud_detector", "TXN002", "high", {"risk_score": 70})
    assert any("risk_score=70" in r.message for r in caplog.records)


def test_sanitize_for_storage_masks_accounts_and_drops_description():
    record = {
        "transaction_id": "TXN001",
        "source_account": "ACC-1001",
        "destination_account": "ACC-2002",
        "description": "sensitive free text",
        "amount": "100.00",
    }
    sanitized = common.sanitize_for_storage(record)
    assert sanitized["source_account"] == "ACC-**01"
    assert sanitized["destination_account"] == "ACC-**02"
    assert "description" not in sanitized
    assert sanitized["amount"] == "100.00"
    # original record is untouched
    assert record["source_account"] == "ACC-1001"
    assert record["description"] == "sensitive free text"


def test_sanitize_for_storage_handles_missing_accounts():
    record = {"transaction_id": "TXN001", "amount": "100.00"}
    sanitized = common.sanitize_for_storage(record)
    assert "source_account" not in sanitized
    assert "destination_account" not in sanitized


def test_write_json_atomic_writes_valid_json_and_no_tmp_file_left(tmp_path):
    target = tmp_path / "out" / "record.json"
    common.write_json_atomic(target, {"transaction_id": "TXN001", "status": "settled"})

    assert target.is_file()
    assert json.loads(target.read_text(encoding="utf-8")) == {"transaction_id": "TXN001", "status": "settled"}
    assert not target.with_suffix(target.suffix + ".tmp").exists()


def test_write_json_atomic_overwrites_existing_file(tmp_path):
    target = tmp_path / "record.json"
    common.write_json_atomic(target, {"v": 1})
    common.write_json_atomic(target, {"v": 2})
    assert json.loads(target.read_text(encoding="utf-8")) == {"v": 2}
