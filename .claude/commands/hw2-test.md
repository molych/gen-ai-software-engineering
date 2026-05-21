---
description: Run the Homework 2 Jest suite with coverage and report the result against the >85% gate
---

Run the Homework 2 test suite with coverage from the `homework-2/` directory:

```
npm test -- --coverage
```

If no npm script exists yet, fall back to `npx jest --coverage`.

Then report:
- Pass/fail counts per test file.
- The coverage summary (statements, branches, functions, lines).
- **Explicitly flag any metric below 85%** and name the files with the lowest
  coverage.

If anything is under 85%, invoke the `coverage-gate` skill to close the gap.
Do not modify source files unless a test reveals a genuine bug — report it first.
