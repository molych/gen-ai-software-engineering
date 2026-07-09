from pipeline import fraud_detector


def _record(**overrides):
    base = {
        "transaction_id": "TXNX",
        "timestamp": "2026-01-01T12:00:00Z",
        "amount": "100.00",
        "currency": "USD",
        "transaction_type": "transfer",
        "metadata": {"channel": "online", "country": "US"},
    }
    base.update(overrides)
    return base


def test_low_value_domestic_daytime_is_low_risk():
    result = fraud_detector.process_transaction(_record())
    assert result["risk_score"] == 0
    assert result["risk_level"] == "low"
    assert result["risk_flags"] == []
    assert result["flagged_for_review"] is False


def test_high_value_wire_transfer_is_medium_and_flagged():
    result = fraud_detector.process_transaction(_record(amount="25000.00", transaction_type="wire_transfer"))
    assert result["risk_score"] == 50
    assert result["risk_level"] == "medium"
    assert set(result["risk_flags"]) == {"high_value", "wire_transfer"}
    assert result["flagged_for_review"] is True


def test_just_under_high_value_threshold_is_not_flagged():
    result = fraud_detector.process_transaction(_record(amount="9999.99"))
    assert result["risk_score"] == 0
    assert result["flagged_for_review"] is False


def test_cross_border_plus_unusual_timing_is_medium_and_flagged():
    result = fraud_detector.process_transaction(
        _record(amount="500.00", timestamp="2026-01-01T02:47:00Z", metadata={"channel": "api", "country": "DE"})
    )
    assert result["risk_score"] == 40
    assert result["risk_level"] == "medium"
    assert set(result["risk_flags"]) == {"cross_border", "unusual_timing"}
    assert result["flagged_for_review"] is True


def test_very_high_value_wire_is_high_risk():
    result = fraud_detector.process_transaction(_record(amount="75000.00", transaction_type="wire_transfer"))
    assert result["risk_score"] == 70
    assert result["risk_level"] == "high"
    assert set(result["risk_flags"]) == {"high_value", "very_high_value", "wire_transfer"}


def test_missing_country_does_not_add_cross_border_flag():
    result = fraud_detector.process_transaction(_record(metadata={"channel": "online"}))
    assert "cross_border" not in result["risk_flags"]


def test_missing_metadata_entirely_does_not_crash():
    result = fraud_detector.process_transaction(_record(metadata=None))
    assert "cross_border" not in result["risk_flags"]


def test_unusual_hour_boundary_not_flagged_at_six_am():
    result = fraud_detector.process_transaction(_record(timestamp="2026-01-01T06:00:00Z"))
    assert "unusual_timing" not in result["risk_flags"]


def test_unusual_hour_boundary_flagged_at_five_fifty_nine():
    result = fraud_detector.process_transaction(_record(timestamp="2026-01-01T05:59:00Z"))
    assert "unusual_timing" in result["risk_flags"]


def test_exact_very_high_value_threshold_not_double_counted():
    result = fraud_detector.process_transaction(_record(amount="50000.00"))
    assert "very_high_value" not in result["risk_flags"]
    assert "high_value" in result["risk_flags"]


def test_exact_high_value_threshold_not_flagged():
    result = fraud_detector.process_transaction(_record(amount="10000.00"))
    assert result["risk_score"] == 0
    assert result["flagged_for_review"] is False


def test_invalid_timestamp_does_not_crash_and_skips_timing_flag():
    result = fraud_detector.process_transaction(_record(timestamp="not-a-timestamp"))
    assert "unusual_timing" not in result["risk_flags"]
