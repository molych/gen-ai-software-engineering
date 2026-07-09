import runpy
from pathlib import Path

from pipeline import settlement_processor

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _record(compliance_status):
    return {"transaction_id": "TXNX", "compliance_status": compliance_status}


def test_clear_transaction_is_settled():
    result = settlement_processor.process_transaction(_record("clear"))
    assert result["final_status"] == "settled"
    assert result["settlement_id"]
    assert result["settled_at"]


def test_ctr_flagged_transaction_is_settled():
    result = settlement_processor.process_transaction(_record("ctr_flagged"))
    assert result["final_status"] == "settled"
    assert result["settlement_id"]


def test_held_for_review_passes_through_without_settlement():
    result = settlement_processor.process_transaction(_record("held_for_review"))
    assert result["final_status"] == "held_for_review"
    assert "settlement_id" not in result
    assert "settled_at" not in result


def test_settlement_ids_are_unique():
    first = settlement_processor.process_transaction(_record("clear"))
    second = settlement_processor.process_transaction(_record("clear"))
    assert first["settlement_id"] != second["settlement_id"]


def test_run_as_script_hits_direct_execution_bootstrap():
    """Executes pipeline/settlement_processor.py via runpy with
    run_name="__main__" so __package__ is empty (matching
    `python pipeline/settlement_processor.py` direct execution) and the
    sys.path bootstrap import branch actually runs -- in-process, so
    coverage.py observes it (a subprocess would not be measured by the
    parent's coverage run)."""
    runpy.run_path(str(PROJECT_ROOT / "pipeline" / "settlement_processor.py"), run_name="__main__")
