from pipeline import currency_codes


def test_known_major_currency_is_valid():
    assert currency_codes.is_valid_currency("USD") is True


def test_all_listed_codes_are_valid():
    for code in currency_codes.VALID_ISO4217_CODES:
        assert currency_codes.is_valid_currency(code) is True


def test_unknown_code_is_invalid():
    assert currency_codes.is_valid_currency("XYZ") is False


def test_lowercase_code_is_normalized_and_valid():
    assert currency_codes.is_valid_currency("usd") is True


def test_empty_string_is_invalid():
    assert currency_codes.is_valid_currency("") is False


def test_non_string_input_is_invalid_not_a_crash():
    assert currency_codes.is_valid_currency(None) is False
    assert currency_codes.is_valid_currency(840) is False
