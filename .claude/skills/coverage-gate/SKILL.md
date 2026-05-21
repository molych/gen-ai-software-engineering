---
name: coverage-gate
description: Run the homework-2 Jest suite, measure coverage, and drive it above the >85% requirement by adding targeted tests. Use whenever tests change or coverage must be verified.
---

# Coverage gate (>85%)

Homework 2 requires **overall test coverage above 85%** (`TASKS.md` Task 3). This is
a hard gate — treat below-85% as a failing build.

## Loop

1. **Run** the suite with coverage:
   ```
   npm test -- --coverage
   ```
   (or `npx jest --coverage` if no npm script exists yet).

2. **Read** the coverage summary table — statements, branches, functions, lines.
   If every metric is ≥ 85%, the gate passes — stop.

3. **Locate gaps.** For any metric under 85%, open the per-file report
   (`coverage/lcov-report/index.html` or the terminal "Uncovered Line #s" column)
   and list the specific files and line ranges not exercised.

4. **Add targeted tests** for those lines — prioritize:
   - error/validation branches (invalid enums, bad email, length limits),
   - malformed CSV/JSON/XML import paths,
   - classification edge cases (no keyword match → `medium`, multiple matches).
   Place them in the matching `tests/test_*` file.

5. **Repeat** from step 1 until the gate passes.

## Notes
- Prefer real assertions over tests that only execute lines — coverage is a proxy
  for behavior, not the goal itself.
- Once green, save the coverage screenshot to `docs/screenshots/test_coverage.png`.
