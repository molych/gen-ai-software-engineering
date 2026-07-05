# Codebase Research — Ticket 001

**Author (role):** Bug Researcher
**Input:** `context/bugs/001/bug-context.md`
**Scope:** `src/services/expenseService.js`, `src/utils/exportUtil.js`, `src/server.js`

---

## Finding BUG-001: Incorrect average in `getSummary`

- **File:** `src/services/expenseService.js`
- **Line:** 36
- **Claimed snippet:**
  ```js
  const average = total / count;
  ```
- **Description:** `getSummary()` computes `average` using the wrong denominator, so the reported
  average never matches `total / count`. This explains symptom (1) in the bug context — the
  summary endpoint returns a number that's consistently off from what QA expects, and behaves
  strangely (`-0`) when there are no expenses at all.
- **Suggested root cause:** the denominator expression subtracts 1 from the count somewhere in
  this function instead of dividing by the plain count.

## Finding BUG-002: Category filter matches everything

- **File:** `src/services/expenseService.js`
- **Line:** 25
- **Claimed snippet:**
  ```js
  if (expense.category == category) {
  ```
- **Description:** `getExpensesByCategory()` uses loose equality (`==`) instead of strict
  equality (`===`) to compare `expense.category` to the requested `category`. Loose equality
  triggers type coercion, which can make unrelated categories compare as equal and explains why
  the filter over-matches (symptom 2).
- **Suggested root cause:** replace `==` with `===`.

## Finding SEC-001: Shell command built from unsanitized filename

- **File:** `src/utils/exportUtil.js`
- **Line:** 20
- **Claimed snippet:**
  ```js
  exec(`cp ${TMP_FILE} ${destination}`, (error, stdout, stderr) => {
  ```
- **Description:** `exportExpensesToFile()` interpolates `destination` (derived from the
  caller-supplied `filename`) directly into a shell command executed via `child_process.exec`,
  with no sanitization or allow-listing. `filename` originates from the JSON body of the
  `POST /expenses/export` request in `src/server.js`. If an attacker supplies shell metacharacters
  (e.g. `; rm -rf /`) as the filename, arbitrary commands would execute on the host. This
  corresponds to symptom (3) — routing to Security Verifier for a full severity assessment.
- **Suggested root cause:** replace the `exec` shell-out with a direct filesystem call (e.g.
  `fs.copyFileSync`) and validate/allow-list the filename.

## Additional Observations (not fully investigated — flagging only)

- `src/middleware/auth.js` defines an API key as a literal string in source. Not in scope for
  this ticket; noting for a future security pass.

---

## References

- `context/bugs/001/bug-context.md`
- `src/services/expenseService.js`
- `src/utils/exportUtil.js`
- `src/server.js`
- `tests/expenseService.test.js` (failing subtests corroborate BUG-001 and BUG-002)
