# Fix Summary — Ticket 001

**Executed by (role):** Bug Fixer
**Plan followed:** `context/bugs/001/implementation-plan.md`
**Test command:** `npm test` (run from the `homework-4/` directory)

All three planned changes were applied, in order, exactly as specified. `npm test` was run after
each change.

---

## Changes Made

### Change 1 — Fix average calculation (BUG-001)

- **File:** `src/services/expenseService.js`
- **Location:** line 35 (inside `getSummary`)
- **Before:**
  ```js
  const average = total / (count - 1);
  ```
- **After:**
  ```js
  const average = count === 0 ? 0 : total / count;
  ```
- **Test result immediately after this change:** `npm test` → **3 pass, 2 fail** (out of 5 total).
  Both target tests flipped from failing to passing as predicted:
  - `getSummary computes total and average across all expenses` — now **passing**.
  - `getSummary does not divide by zero when there are no expenses` — now **passing**.
  Remaining failure was the still-unfixed `getExpensesByCategory returns only matching expenses
  without mutating others` (expected, addressed in Change 2), plus the parent suite rollup
  failure it causes.

### Change 2 — Fix category filter (BUG-002)

- **File:** `src/services/expenseService.js`
- **Location:** line 25 (inside `getExpensesByCategory`)
- **Before:**
  ```js
  if (expense.category = category) {
  ```
- **After:**
  ```js
  if (expense.category === category) {
  ```
- **Test result immediately after this change:** `npm test` → **5 pass, 0 fail** (all 5 tests
  passing). `getExpensesByCategory returns only matching expenses without mutating others` flipped
  from failing to passing as predicted, with no regressions in the previously-fixed `getSummary`
  tests.

### Change 3 — Remove command injection in export (SEC-001)

- **File:** `src/utils/exportUtil.js`
- **Location:** lines 1-23 (import list + `exportExpensesToFile`)
- **Before:**
  ```js
  const fs = require('fs');
  const path = require('path');
  const { exec } = require('child_process');
  ```
  ```js
  function exportExpensesToFile(expenses, filename, callback) {
    const csvContent = toCsv(expenses);
    fs.writeFileSync(TMP_FILE, csvContent);
    const destination = path.join(EXPORTS_DIR, filename);
    exec(`cp ${TMP_FILE} ${destination}`, (error, stdout, stderr) => {
      callback(error, destination);
    });
  }
  ```
- **After:**
  ```js
  const fs = require('fs');
  const path = require('path');
  ```
  ```js
  const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/;

  function exportExpensesToFile(expenses, filename, callback) {
    if (typeof filename !== 'string' || !SAFE_FILENAME_PATTERN.test(filename)) {
      return callback(
        new Error('Invalid filename: only letters, numbers, dot, dash, and underscore are allowed.')
      );
    }
    const csvContent = toCsv(expenses);
    fs.writeFileSync(TMP_FILE, csvContent);
    const destination = path.join(EXPORTS_DIR, path.basename(filename));
    fs.copyFile(TMP_FILE, destination, (error) => {
      callback(error, destination);
    });
  }
  ```
- **Test result immediately after this change:** `npm test` → **5 pass, 0 fail**. No existing test
  exercises `exportUtil.js`, so no test changed status — this matches the plan's "no regression
  expected" call-out.

---

## Overall Status

- All 3 planned changes were applied, in the order specified, with no deviation from the plan's
  before/after code.
- Every "before" snippet was confirmed present at (or very near) the stated location before
  editing.
- No test failed unexpectedly at any step; every test-status change matched the plan's
  predictions.
- **Final `npm test` result: 5 pass, 0 fail, 0 skipped, 0 cancelled** (test run duration ~36ms).
  The suite (`tests/expenseService.test.js`) is fully green.
- No unrelated issues were noticed during editing; nothing has been deferred to a future ticket.

---

## Manual Verification

For a human reviewer to confirm the fixes against the running app:

1. `npm start` (starts the API on port 3000).
2. `curl -X POST localhost:3000/expenses -H 'Content-Type: application/json' -d '{"description":"Coffee","amount":4,"category":"food"}'`
   (repeat with a `transport` entry).
3. `curl localhost:3000/expenses/summary` — average should equal `total / count` exactly (no more
   off-by-one denominator, no `-0` when empty).
4. `curl 'localhost:3000/expenses?category=food'` — should return only `food` expenses; a
   follow-up `curl localhost:3000/expenses` should show the `transport` entry unchanged (i.e. the
   filter no longer mutates stored data).
5. `curl 'localhost:3000/expenses/export?filename=out.csv'` — should succeed and create
   `exports/out.csv`. `curl 'localhost:3000/expenses/export?filename=out.csv;%20touch%20/tmp/pwned'`
   should be **rejected** with the invalid-filename error, not executed (confirms the shell-out is
   gone and the filename allow-list is enforced).

---

## References

- Plan file: `context/bugs/001/implementation-plan.md`
- Files edited:
  - `src/services/expenseService.js` (Changes 1 and 2)
  - `src/utils/exportUtil.js` (Change 3)
- Test command used: `npm test` (run from the `homework-4/` directory)
