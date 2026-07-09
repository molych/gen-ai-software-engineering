"""Static ISO 4217 currency code allow-list.

Kept as a static set (no network lookups) so validation stays deterministic
and testable offline. Covers the major/common active ISO 4217 codes; extend
as needed for additional currencies.
"""

VALID_ISO4217_CODES = frozenset({
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "HKD",
    "SGD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "HRK",
    "ISK", "TRY", "RUB", "UAH", "INR", "IDR", "MYR", "PHP", "THB", "VND",
    "KRW", "TWD", "ZAR", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "ILS",
    "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD", "EGP", "NGN", "KES",
    "GHS", "MAD", "TND", "PKR", "BDT", "LKR", "NPR", "KZT", "AZN", "GEL",
})


def is_valid_currency(code: str) -> bool:
    """True if `code` is a recognized ISO 4217 currency code."""
    return isinstance(code, str) and code.upper() in VALID_ISO4217_CODES
