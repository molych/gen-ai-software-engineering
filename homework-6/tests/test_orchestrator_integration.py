import json
import sys
from pathlib import Path

import orchestrator

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_INPUT = PROJECT_ROOT / "sample-transactions.json"


def test_run_pipeline_produces_expected_split(tmp_shared):
    summary = orchestrator.run_pipeline(input_path=SAMPLE_INPUT, shared_root=tmp_shared)

    assert summary["total"] == 8
    assert summary["settled"] == 5
    assert summary["held_for_review"] == 1
    assert summary["rejected"] == 2
    assert summary["rejection_reasons"]["TXN006"] == "invalid_currency_code:XYZ"
    assert summary["rejection_reasons"]["TXN007"] == "amount_must_be_positive"


def test_run_pipeline_writes_valid_json_for_every_transaction(tmp_shared):
    orchestrator.run_pipeline(input_path=SAMPLE_INPUT, shared_root=tmp_shared)

    result_files = sorted((tmp_shared / "results").glob("TXN*.json"))
    assert len(result_files) == 8
    for path in result_files:
        record = json.loads(path.read_text(encoding="utf-8"))
        assert "final_status" in record
        assert "description" not in record


def test_run_pipeline_creates_all_shared_subdirectories(tmp_shared):
    orchestrator.run_pipeline(input_path=SAMPLE_INPUT, shared_root=tmp_shared)

    for sub in ("input", "processing", "output", "results"):
        assert (tmp_shared / sub).is_dir()
        assert any((tmp_shared / sub).iterdir())


def test_setup_directories_creates_expected_paths(tmp_path):
    dirs = orchestrator.setup_directories(tmp_path / "fresh_shared")
    assert set(dirs.keys()) == {"input", "processing", "output", "results"}
    for path in dirs.values():
        assert path.is_dir()


def test_load_transactions_reads_json_list(tmp_path):
    sample_file = tmp_path / "mini.json"
    sample_file.write_text(json.dumps([{"transaction_id": "A"}]), encoding="utf-8")
    records = orchestrator.load_transactions(sample_file)
    assert records == [{"transaction_id": "A"}]


def test_summary_file_matches_returned_summary(tmp_shared):
    summary = orchestrator.run_pipeline(input_path=SAMPLE_INPUT, shared_root=tmp_shared)
    on_disk = json.loads((tmp_shared / "results" / "_summary.json").read_text(encoding="utf-8"))
    assert on_disk == summary


def test_orchestrator_main_cli(tmp_path, monkeypatch, capsys):
    shared_root = tmp_path / "cli_shared"
    monkeypatch.setattr(
        sys, "argv",
        ["orchestrator.py", "--input", str(SAMPLE_INPUT), "--shared-dir", str(shared_root)],
    )
    orchestrator.main()
    captured = capsys.readouterr()
    assert "Total transactions:  8" in captured.out
    assert "Settled:             5" in captured.out
    assert "TXN006: invalid_currency_code:XYZ" in captured.out


def test_missing_transaction_id_gets_synthetic_name(tmp_shared, tmp_path):
    sample_file = tmp_path / "no_id.json"
    record = {
        "timestamp": "2026-01-01T12:00:00Z",
        "source_account": "ACC-1",
        "destination_account": "ACC-2",
        "amount": "50.00",
        "currency": "USD",
        "transaction_type": "transfer",
        "description": "test",
    }
    sample_file.write_text(json.dumps([record]), encoding="utf-8")
    summary = orchestrator.run_pipeline(input_path=sample_file, shared_root=tmp_shared)
    assert summary["total"] == 1
    assert summary["rejected"] == 1
    result_files = list((tmp_shared / "results").glob("unknown-*.json"))
    assert len(result_files) == 1
