import json
import runpy
import sys
from pathlib import Path

from pipeline import validator

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLES = {
    t["transaction_id"]: t
    for t in json.loads((PROJECT_ROOT / "sample-transactions.json").read_text(encoding="utf-8"))
}


def test_txn001_normal_transfer_validates():
    result = validator.process_transaction(SAMPLES["TXN001"])
    assert result["status"] == "validated"
    assert result["reason"] is None
    assert result["data"]["amount"] == "1500.00"


def test_txn002_high_value_wire_validates():
    result = validator.process_transaction(SAMPLES["TXN002"])
    assert result["status"] == "validated"


def test_txn003_just_under_threshold_validates():
    result = validator.process_transaction(SAMPLES["TXN003"])
    assert result["status"] == "validated"


def test_txn004_cross_border_validates():
    result = validator.process_transaction(SAMPLES["TXN004"])
    assert result["status"] == "validated"


def test_txn005_very_high_value_validates():
    result = validator.process_transaction(SAMPLES["TXN005"])
    assert result["status"] == "validated"


def test_txn006_invalid_currency_rejected():
    result = validator.process_transaction(SAMPLES["TXN006"])
    assert result["status"] == "rejected"
    assert result["reason"] == "invalid_currency_code:XYZ"


def test_txn007_negative_amount_always_rejected():
    result = validator.process_transaction(SAMPLES["TXN007"])
    assert result["status"] == "rejected"
    assert result["reason"] == "amount_must_be_positive"


def test_txn008_normal_transfer_validates():
    result = validator.process_transaction(SAMPLES["TXN008"])
    assert result["status"] == "validated"


def test_missing_required_field_rejected():
    record = dict(SAMPLES["TXN001"])
    del record["currency"]
    result = validator.process_transaction(record)
    assert result["status"] == "rejected"
    assert result["reason"].startswith("missing_required_field:")
    assert "currency" in result["reason"]


def test_missing_transaction_id_rejected():
    record = dict(SAMPLES["TXN001"])
    del record["transaction_id"]
    result = validator.process_transaction(record)
    assert result["status"] == "rejected"
    assert result["transaction_id"] is None


def test_amount_not_numeric_rejected():
    record = dict(SAMPLES["TXN001"])
    record["amount"] = "not-a-number"
    result = validator.process_transaction(record)
    assert result["status"] == "rejected"
    assert result["reason"] == "amount_not_numeric"


def test_zero_amount_rejected():
    record = dict(SAMPLES["TXN001"])
    record["amount"] = "0.00"
    result = validator.process_transaction(record)
    assert result["status"] == "rejected"
    assert result["reason"] == "amount_must_be_positive"


def test_invalid_timestamp_rejected():
    record = dict(SAMPLES["TXN001"])
    record["timestamp"] = "not-a-timestamp"
    result = validator.process_transaction(record)
    assert result["status"] == "rejected"
    assert result["reason"] == "invalid_timestamp"


def test_unsupported_transaction_type_rejected():
    record = dict(SAMPLES["TXN001"])
    record["transaction_type"] = "withdrawal"
    result = validator.process_transaction(record)
    assert result["status"] == "rejected"
    assert result["reason"] == "unsupported_transaction_type:withdrawal"


def test_account_numbers_masked_and_description_dropped():
    result = validator.process_transaction(SAMPLES["TXN001"])
    assert result["data"]["source_account"] != SAMPLES["TXN001"]["source_account"]
    assert result["data"]["source_account"].startswith("ACC-")
    assert "description" not in result["data"]


def test_rejected_record_also_masked():
    result = validator.process_transaction(SAMPLES["TXN006"])
    assert result["data"]["source_account"] != SAMPLES["TXN006"]["source_account"]
    assert "description" not in result["data"]


def test_dry_run_cli_prints_summary(tmp_path, capsys):
    sample_file = tmp_path / "sample.json"
    sample_file.write_text(json.dumps([SAMPLES["TXN001"], SAMPLES["TXN006"]]), encoding="utf-8")
    validator._run_dry_run(sample_file)
    captured = capsys.readouterr()
    assert "Total transactions:   2" in captured.out
    assert "TXN006" in captured.out
    assert "invalid_currency_code:XYZ" in captured.out


def test_main_dry_run_argument(tmp_path, monkeypatch, capsys):
    sample_file = tmp_path / "sample.json"
    sample_file.write_text(json.dumps([SAMPLES["TXN001"]]), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["validator.py", "--input", str(sample_file), "--dry-run"])
    validator.main()
    captured = capsys.readouterr()
    assert "Total transactions:   1" in captured.out


def test_main_without_dry_run_flag_still_runs(tmp_path, monkeypatch, capsys):
    sample_file = tmp_path / "sample.json"
    sample_file.write_text(json.dumps([SAMPLES["TXN001"]]), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["validator.py", "--input", str(sample_file)])
    validator.main()
    captured = capsys.readouterr()
    assert "Total transactions:   1" in captured.out


def test_run_as_script_hits_direct_execution_bootstrap(tmp_path, monkeypatch, capsys):
    """Executes pipeline/validator.py via runpy with run_name="__main__" so
    __package__ is empty (matching `python pipeline/validator.py --dry-run`
    direct execution, as documented in HOWTORUN.md) and the sys.path
    bootstrap import branch plus the `if __name__ == "__main__": main()`
    guard both actually run -- in-process, so coverage.py observes them
    (a subprocess would not be measured by the parent's coverage run)."""
    sample_file = tmp_path / "sample.json"
    sample_file.write_text(json.dumps([SAMPLES["TXN001"], SAMPLES["TXN006"]]), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["validator.py", "--input", str(sample_file), "--dry-run"])

    runpy.run_path(str(PROJECT_ROOT / "pipeline" / "validator.py"), run_name="__main__")

    captured = capsys.readouterr()
    assert "Total transactions:   2" in captured.out
    assert "invalid_currency_code:XYZ" in captured.out
