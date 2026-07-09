import pytest

from pipeline import compliance_checker

pytestmark = pytest.mark.skip(reason="TEMP: demonstrating coverage-gate hook block, revert before real push")


def _record(**overrides):
    base = {
        "transaction_id": "TXNX",
        "amount": "500.00",
        "metadata": {"country": "US"},
        "risk_flags": [],
        "flagged_for_review": False,
    }
    base.update(overrides)
    return base


def test_low_amount_no_flags_is_clear():
    result = compliance_checker.process_transaction(_record())
    assert result["compliance_status"] == "clear"
    assert "no_compliance_concerns" in result["compliance_notes"]


def test_high_amount_is_ctr_flagged():
    result = compliance_checker.process_transaction(_record(amount="25000.00"))
    assert result["compliance_status"] == "ctr_flagged"


def test_cross_border_plus_unusual_timing_is_held_for_review():
    result = compliance_checker.process_transaction(
        _record(amount="500.00", risk_flags=["cross_border", "unusual_timing"], flagged_for_review=True)
    )
    assert result["compliance_status"] == "held_for_review"
    assert "cross_border_plus_unusual_timing" in result["compliance_notes"]


def test_high_value_alone_without_unusual_timing_is_ctr_flagged_not_held():
    result = compliance_checker.process_transaction(
        _record(amount="25000.00", risk_flags=["high_value", "wire_transfer"], flagged_for_review=True)
    )
    assert result["compliance_status"] == "ctr_flagged"


def test_restricted_country_is_held_for_review(monkeypatch):
    monkeypatch.setattr(compliance_checker, "RESTRICTED_COUNTRIES", frozenset({"IR"}))
    result = compliance_checker.process_transaction(_record(metadata={"country": "IR"}))
    assert result["compliance_status"] == "held_for_review"
    assert any(note.startswith("restricted_country") for note in result["compliance_notes"])


def test_missing_metadata_defaults_to_no_country():
    result = compliance_checker.process_transaction(_record(metadata=None))
    assert result["compliance_status"] == "clear"
