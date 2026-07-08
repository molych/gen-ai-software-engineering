# Fix Summary — Ticket 001

## Changes Made

### Change 1 — Fix average calculation (BUG-001)

**File:** `src/services/expenseService.js`
**Location:** inside `getSummary` (line 35)

**Before:**
```js
  const average = total / (count - 1);
```

**After:**
```js
  const average = count === 0 ? 0 : total / count;
```

**Test result immediately after this change:** `npm test` → 3 pass, 2 fail.
- `getSummary computes total and average across all expenses` — now **passing** (expected).
- `getSummary does not divide by zero when there are no expenses` — now **passing** (expected).
- `getExpensesByCategory returns only matching expenses without mutating others` — still
  **failing** (`3 !== 2`), exactly as expected since Change 2 had not been applied yet.

---

### Change 2 — Fix category filter (BUG-002)

**File:** `src/services/expenseService.js`
**Location:** inside `getExpensesByCategory` (line 25)

**Before:**
```js
    if (expense.category = category) {
```

**After:**
```js
    if (expense.category === category) {
```

**Test result immediately after this change:** `npm test` → 5 pass, 0 fail. All tests, including
`getExpensesByCategory returns only matching expenses without mutating others`, passing.

---

### Change 3 — Remove command injection in export (SEC-001)

**File:** `src/utils/exportUtil.js`
**Location:** lines 1-23 (import list + `exportExpensesToFile`)

**Before:**
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

**After:**
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

**Test result immediately after this change:** `npm test` → 5 pass, 0 fail (no regression, as
expected — no existing test exercises this function).

---

## Overall Status

All three planned changes were applied, in order, exactly as specified in
`context/bugs/001/implementation-plan.md`. No mismatches were found between the plan's "before"
snippets and the actual file contents. No test failed unexpectedly at any step.

Final `npm test` output summary:
```
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## Manual Verification

For the human reviewer, after the pipeline completes:

1. `npm start` (starts the API on port 3000).
2. `curl -X POST localhost:3000/expenses -H 'Content-Type: application/json' -d '{"description":"Coffee","amount":4,"category":"food"}'` (repeat with a `transport` entry).
3. `curl localhost:3000/expenses/summary` — average should equal `total / count` exactly.
4. `curl 'localhost:3000/expenses?category=food'` — should return only `food` expenses; a
   follow-up `curl localhost:3000/expenses` should show the `transport` entry unchanged.
5. `curl 'localhost:3000/expenses/export?filename=out.csv'` — should succeed and create
   `exports/out.csv`. `curl 'localhost:3000/expenses/export?filename=out.csv;%20touch%20/tmp/pwned'`
   should be **rejected** with the invalid-filename error, not executed.

## References

- Plan: `context/bugs/001/implementation-plan.md`
- Edited: `src/services/expenseService.js`
- Edited: `src/utils/exportUtil.js`
- Test command: `npm test` (run from `homework-4/`)
