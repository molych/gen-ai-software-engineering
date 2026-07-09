# Research Notes — context7 MCP Queries

This project's `mcp.json` / `.mcp.json` configure the `context7` MCP server (`npx -y @upstash/context7-mcp@latest`) alongside the custom `pipeline-status` server. Per Task 4, at least 2 context7 queries made while building the pipeline are documented here, with the search term, the library ID context7 returned, and the concrete insight/pattern applied.

## Query 1: Python decimal module for monetary precision

- Search: "Python decimal module" → resolved via `resolve-library-id` (`libraryName: "Python"`, query: "Python decimal module for precise monetary arithmetic and rounding modes"), then queried with "decimal.Decimal rounding modes ROUND_HALF_UP and constructing Decimal from string vs float"
- context7 library ID: `/python/cpython` (Source Reputation: High, 48078 code snippets)
- Applied: confirmed `ROUND_HALF_UP` ("round to nearest with ties going away from zero") is the correct rounding mode for settlement figures, and — more importantly — confirmed via the `Decimal.from_float()` / `Decimal(str(2.0 ** 0.5))` examples in the docs that constructing a `Decimal` directly from a `float` silently captures binary floating-point imprecision (e.g. `Decimal.from_float(0.1)` → `Decimal('0.1000000000000000055511151231257827021181583404541015625')`), while `Decimal(str(amount))` does not. This validated the construction pattern already used throughout `pipeline/validator.py` and `pipeline/common.py` — every `amount` is parsed as `Decimal(str(amount))`, never `Decimal(amount)` on a float.

## Query 2: pytest-cov fail-under configuration

- Search: "pytest-cov coverage fail-under configuration" → resolved via `resolve-library-id` (`libraryName: "pytest-cov"`), then queried with "cov-fail-under command line option to fail build when coverage below threshold"
- context7 library ID: `/pytest-dev/pytest-cov` (Source Reputation: High, 260 code snippets)
- Applied: confirmed `--cov-fail-under MIN` is the correct flag (accepts an int/float up to 100, exits non-zero and prints `Required test coverage of N% not reached` when under the threshold) and that it can alternatively live in `.coveragerc`. This validated the exact invocation used in `.claude/hooks/check-coverage.sh` — `pytest --cov=pipeline --cov-fail-under=80` — as the correct way to gate `git push` on the 80% coverage floor.
