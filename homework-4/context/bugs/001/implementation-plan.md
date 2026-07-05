# Implementation Plan — Ticket 001

**Author (role):** Bug Planner
**Inputs:**
- `context/bugs/001/research/codebase-research.md` (original research)
- `context/bugs/001/research/verified-research.md` (**authoritative** — corrects 3 discrepancies
  in the document above; use the corrected diagnoses below, not the original snippets/claims)

**Test command:** `npm test` (run from the `homework-4/` directory)

Apply the three changes below **in order**. Run `npm test` after each change. If a test fails
that the plan did not expect to fail, stop and document it — do not proceed to the next change.

---

## Change 1 — Fix average calculation (BUG-001)

**File:** `src/services/expenseService.js`
**Location:** line 35 (inside `getSummary`)

**Before:**
```js
  const average = total / (count - 1);
```

**After:**
```js
  const average = count === 0 ? 0 : total / count;
```

**Rationale:** The verified research confirmed the denominator is `count - 1` instead of `count`,
and that this also produces `-0` (not a clean `0`) when there are no expenses. The fix divides by
the plain count and short-circuits to `0` when `count` is `0` to avoid `0/0`-style edge cases.

**Expected test effect:** `getSummary computes total and average across all expenses` and
`getSummary does not divide by zero when there are no expenses` (both in
`tests/expenseService.test.js`) should go from failing to passing.

---

## Change 2 — Fix category filter (BUG-002)

**File:** `src/services/expenseService.js`
**Location:** line 25 (inside `getExpensesByCategory`)

**Before:**
```js
    if (expense.category = category) {
```

**After:**
```js
    if (expense.category === category) {
```

**Rationale:** Verified research found this is an **assignment** (`=`), not the loose-equality bug
originally reported — it overwrites every visited expense's `category` with the filter value and
always evaluates truthy, so the filter both over-matches and corrupts stored data. Using strict
equality (`===`) makes this a pure, non-mutating comparison.

**Expected test effect:**
`getExpensesByCategory returns only matching expenses without mutating others` should go from
failing to passing.

---

## Change 3 — Remove command injection in export (SEC-001)

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

**Rationale:** Verified research confirmed the vulnerable line and mechanism (unsanitized
`filename` interpolated into a shell command via `child_process.exec`) but mis-described the input
vector as a POST JSON body; it is actually the `filename` query-string parameter on
`GET /expenses/export` (see `src/server.js`, unchanged by this ticket). The fix (a) removes the
shell-out entirely in favor of `fs.copyFile`, so no string is ever interpreted by a shell, and
(b) allow-lists the filename to safe characters and applies `path.basename` as defense-in-depth
against path traversal, independent of how the caller passes the value.

**Expected test effect:** no existing test exercises this function; no regression expected. (The
Unit Test Generator stage, run later on this changed file, is expected to add coverage here.)

---

## Manual Verification (for the human reviewer, after the pipeline completes)

1. `npm start` (starts the API on port 3000).
2. `curl -X POST localhost:3000/expenses -H 'Content-Type: application/json' -d '{"description":"Coffee","amount":4,"category":"food"}'` (repeat with a `transport` entry).
3. `curl localhost:3000/expenses/summary` — average should equal `total / count` exactly.
4. `curl 'localhost:3000/expenses?category=food'` — should return only `food` expenses; a
   follow-up `curl localhost:3000/expenses` should show the `transport` entry unchanged.
5. `curl 'localhost:3000/expenses/export?filename=out.csv'` — should succeed and create
   `exports/out.csv`. `curl 'localhost:3000/expenses/export?filename=out.csv;%20touch%20/tmp/pwned'`
   should be **rejected** with the invalid-filename error, not executed.

---

## References

- `context/bugs/001/research/codebase-research.md`
- `context/bugs/001/research/verified-research.md`
- `src/services/expenseService.js`
- `src/utils/exportUtil.js`
