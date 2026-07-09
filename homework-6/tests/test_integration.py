"""In-memory pipeline integration test: chains validator -> fraud_detector ->
compliance_checker -> settlement_processor directly on a small synthetic
dataset, with no file I/O and no shared/ directory involved at all (contrast
with test_orchestrator_integration.py, which drives the file-based
orchestrator.run_pipeline() protocol against an isolated tmp_path tree).
"""

from decimal import Decimal

from pipeline import compliance_checker, fraud_detector, settlement_processor, validator

DATASET = [
    {
        "transaction_id": "INT001",
        "timestamp": "2026-01-01T14:00:00Z",
        "source_account": "ACC-1001",
        "destination_account": "ACC-2002",
        "amount": Decimal("250.00"),
        "currency": "USD",
        "transaction_type": "transfer",
        "metadata": {"channel": "online", "country": "US"},
    },
    {
        "transaction_id": "INT002",
        "timestamp": "2026-01-01T14:00:00Z",
        "source_account": "ACC-1003",
        "destination_account": "ACC-2004",
        "amount": Decimal("25000.00"),
        "currency": "USD",
        "transaction_type": "wire_transfer",
        "metadata": {"channel": "api", "country": "US"},
    },
    {
        "transaction_id": "INT003",
        "timestamp": "2026-01-01T02:30:00Z",
        "source_account": "ACC-1005",
        "destination_account": "ACC-2006",
        "amount": Decimal("500.00"),
        "currency": "EUR",
        "transaction_type": "wire_transfer",
        "metadata": {"channel": "api", "country": "DE"},
    },
    {
        "transaction_id": "INT004",
        "timestamp": "2026-01-01T14:00:00Z",
        "source_account": "ACC-1007",
        "destination_account": "ACC-2008",
        "amount": Decimal("100.00"),
        "currency": "ZZZ",
        "transaction_type": "transfer",
        "metadata": {"channel": "online", "country": "US"},
    },
]


def run_through_pipeline(raw_record: dict) -> dict:
    """Chain the four stage functions the same way orchestrator._process_one
    does, purely in memory (no shared/ writes)."""
    validator_result = validator.process_transaction(raw_record)

    if validator_result["status"] == "rejected":
        final = dict(validator_result["data"])
        final["transaction_id"] = raw_record["transaction_id"]
        final["status"] = "rejected"
        final["reason"] = validator_result["reason"]
        final["final_status"] = "rejected"
        return final

    current = dict(validator_result["data"])
    current["transaction_id"] = raw_record["transaction_id"]
    current["status"] = "validated"

    current = fraud_detector.process_transaction(current)
    current = compliance_checker.process_transaction(current)
    current = settlement_processor.process_transaction(current)
    return current


def test_normal_low_value_transfer_is_settled():
    result = run_through_pipeline(DATASET[0])
    assert result["final_status"] == "settled"
    assert result["compliance_status"] == "clear"
    assert result["risk_level"] == "low"
    assert result["settlement_id"]


def test_high_value_domestic_wire_is_ctr_flagged_and_settled():
    result = run_through_pipeline(DATASET[1])
    assert set(result["risk_flags"]) == {"high_value", "wire_transfer"}
    assert result["compliance_status"] == "ctr_flagged"
    assert result["final_status"] == "settled"
    assert result["settlement_id"]


def test_cross_border_unusual_hour_wire_is_held_for_review():
    result = run_through_pipeline(DATASET[2])
    assert set(result["risk_flags"]) >= {"cross_border", "unusual_timing"}
    assert result["compliance_status"] == "held_for_review"
    assert result["final_status"] == "held_for_review"
    assert "settlement_id" not in result


def test_invalid_currency_rejected_before_reaching_fraud_detection():
    result = run_through_pipeline(DATASET[3])
    assert result["status"] == "rejected"
    assert result["final_status"] == "rejected"
    assert result["reason"] == "invalid_currency_code:ZZZ"
    # never made it past the validator, so no fraud/compliance/settlement fields
    assert "risk_score" not in result
    assert "compliance_status" not in result
    assert "settlement_id" not in result


def test_full_small_dataset_end_to_end_split():
    results = [run_through_pipeline(record) for record in DATASET]
    statuses = [r["final_status"] for r in results]
    assert statuses == ["settled", "settled", "held_for_review", "rejected"]
    # account numbers never leak through in their raw form at any stage
    for raw, result in zip(DATASET, results):
        if "source_account" in result:
            assert result["source_account"] != raw["source_account"]
