# Security Report — Ticket 001

**Reviewer (role):** Security Vulnerabilities Verifier
**Input under review:** `context/bugs/001/fix-summary.md`

## Scope

Files actually changed by the Bug Fixer (per `fix-summary.md` → *Changes Made* / *References*),
reviewed in full (not just diffed lines):

- `src/services/expenseService.js` — Change 1 (BUG-001, `getSummary`) and Change 2 (BUG-002, `getExpensesByCategory`).
- `src/utils/exportUtil.js` — Change 3 (SEC-001, `exportExpensesToFile`).

Data flow was traced one hop upstream and downstream through `src/server.js` (the HTTP routes
that invoke both files) to confirm where the reviewed inputs actually originate. `src/middleware/auth.js`
and `src/services/expenseService.js::addExpense` were opened while tracing and are reported under
*Out-of-Scope Observations*.

**Verification environment:** Node.js `node -e` snippets run from `homework-4/`, read-only (no
`fs` writes, no `child_process`, no network). The filename-validation regex was exercised directly
against the ticket's payloads plus traversal/newline variants. No application file was modified.

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 3 |
| INFO     | 3 |

**Originally-fixed vulnerability (SEC-001, command injection in export):** **Confirmed remediated.**
The `child_process.exec` shell-out is gone, replaced by `fs.copyFile`; the untrusted `filename` is
allowlist-validated and passed through `path.basename`. Every injection and traversal payload I
tested was rejected. No new regression was introduced by the two functional fixes (BUG-001, BUG-002).

## Findings

### INFO-1 — Command injection (SEC-001) remediated — `src/utils/exportUtil.js:17-29`
The prior sink `exec(\`cp ${TMP_FILE} ${destination}\`, ...)` is removed. The function now (a)
rejects any `filename` that isn't a string matching `/^[A-Za-z0-9._-]+$/` (line 18), (b) copies via
the non-shell `fs.copyFile` (line 26), and (c) applies `path.basename` (line 25) as defense-in-depth.
The `child_process` import was also removed (file no longer requires it).

**Verified:** ran the allowlist + `path.basename`/`path.join` against the ticket's exploit strings.
Observed results:
- `out.csv; touch /tmp/pwned` → **REJECT**
- `out.csv;%20touch%20/tmp/pwned` (the exact ticket manual-test payload) → **REJECT**
- `$(whoami)`, `` `id` `` → **REJECT**
- `../../etc/passwd`, `..%2F..%2Fetc%2Fpasswd` → **REJECT** (`/` and `%` not in charset)
- `a/b`, `a\b` → **REJECT**
- `out.csv\n; rm -rf /` → **REJECT** (JS `$` without the `m` flag does not match before a trailing
  newline, so the classic multiline-anchor bypass does not apply here — confirmed empirically).

**Category rating rationale:** not scored CRITICAL-by-name; the shell sink is genuinely gone and
the only remaining external input into the copy is a validated basename, so there is no traced path
to command execution. **INFO** (confirms the reported vuln is fixed).

### LOW-1 — Allowlist accepts `.` and `..` — `src/utils/exportUtil.js:15,18,25`
`/^[A-Za-z0-9._-]+$/` accepts the relative-path tokens `.` and `..` (both consist only of dots).
Traced impact:
- `filename = ".."` → `path.basename("..")` is `".."` → `path.join(EXPORTS_DIR, "..")` resolves to
  the **parent of the exports directory**.
- `filename = "."` → resolves to the exports directory itself.

In both cases the resolved `destination` is an existing **directory**, so `fs.copyFile(TMP_FILE, dir)`
fails with `EISDIR` and is surfaced as a 500 — it does **not** write a file. Crucially, because `/`
and `\` are rejected, an attacker cannot append a target filename (e.g. `../evil.csv`), so there is
**no arbitrary-file-write-outside-exports primitive**. Worst realistic case is overwriting a file
*inside* `exports/` (e.g. `.staging.csv`), which is inconsequential.

*(I reasoned about `fs.copyFile`-to-directory semantics rather than executing a real copy, to avoid
filesystem side effects; the resolution paths above were computed with `path.join`/`path.basename`.)*

**Remediation:** explicitly reject `.` and `..` (e.g. `if (filename === '.' || filename === '..')`)
or require an extension, so the intent of the allowlist is unambiguous. **LOW** (defense-in-depth;
not exploitable for escape in current form).

### LOW-2 — CSV formula/row injection in export output — `src/utils/exportUtil.js:9-11`
`toCsv` interpolates `description`, `category`, and `amount` directly into CSV cells
(`\`${e.id},${e.description},${e.amount},${e.category}\``) with no quoting or escaping. These values
originate unvalidated from the `POST /expenses` JSON body (`server.js:34-36` → `addExpense`, which
stores them verbatim). A description such as `=cmd|'/c calc'!A1` or one containing `\n`/`,` can inject
spreadsheet formulas or extra rows into the exported file.

`toCsv` was **not modified** by this ticket, but it lives in a changed file and is the payload builder
for the reviewed export path, so it is in scope. Practical exploitability is limited in this
deployment: the CSV is written to the server's `exports/` directory (not returned in the HTTP
response body, not rendered as HTML), so triggering the formula requires a human to later open the
file in Excel/Sheets. **LOW.**

**Remediation:** wrap fields in double quotes with `"` escaping, and prefix cells beginning with
`= + - @` with a `'` (standard CSV-injection neutralization).

### LOW-3 — `amount` unvalidated before it feeds the average calculation — `src/services/expenseService.js:33-35` (source: `addExpense`, lines 4-13)
The Change-1 fix correctly guards the divisor (`count === 0 ? 0 : total / count`), but the *dividend*
is still built from unvalidated input: `addExpense` stores `amount` verbatim from the request body,
and `getSummary` computes `total = expenses.reduce((sum, e) => sum + e.amount, 0)`. If any `amount`
is non-numeric (e.g. `"abc"` or missing), `+` performs string concatenation and `total`/`average`
become `NaN` or a garbage string, which serializes to `null` in the JSON response.

**Verified conceptually / traceable:** `sum + expense.amount` with a string `amount` is JS string
concatenation; `string / number` → `NaN`. No throw, no crash, no memory/DoS impact.

**Category rating rationale:** this is a missing-input-validation weakness that corrupts a computed
field, not a path to compromise or denial of service. `addExpense` itself is unchanged by this
ticket; the changed `getSummary` merely consumes it. **LOW.**

**Remediation:** coerce/validate `amount` to a finite number in `addExpense` (reject otherwise), so
the arithmetic in `getSummary` is well-typed.

### INFO-2 — BUG-001 fixed correctly — `src/services/expenseService.js:35`
`const average = count === 0 ? 0 : total / count;` — divide-by-zero is guarded and the denominator
is now `count` (not `count - 1`). Matches `tests/expenseService.test.js:31-49`. No security impact.

### INFO-3 — BUG-002 fixed correctly (no residual mutation) — `src/services/expenseService.js:25`
`if (expense.category === category)` — the prior single-`=` **assignment** (which both over-matched
and mutated `expense.category`) is replaced with strict equality. Confirmed no assignment/mutation
remains in the predicate; corroborated by `tests/expenseService.test.js:19` ("without mutating
others"). No security impact.

## Category Coverage (per changed-file scan checklist)

- **Injection — command:** remediated (INFO-1). **CSV/formula:** LOW-2. **SQL/NoSQL:** not
  applicable — the app has no database; expenses live in an in-memory array. **Path/template:**
  path traversal is blocked by the allowlist (no `/`, `\`, `%`) plus `path.basename`; residual `.`/`..`
  acceptance is LOW-1 and non-escaping.
- **Hardcoded secrets:** none in the two changed files. (A hardcoded key exists in `auth.js` — see
  Out-of-Scope Observations.)
- **Insecure comparisons:** `getExpensesByCategory` now uses strict `===` (INFO-3). No secret/token
  comparison occurs in the changed files, so constant-time concerns don't apply here.
- **Missing validation:** `filename` is now validated (INFO-1); `amount` remains unvalidated (LOW-3).
- **Unsafe dependencies:** `package.json` declares **zero** runtime dependencies, and Change 3
  *removed* the `child_process` shell-out in favor of the `fs` library call — net reduction in risk.
  Not applicable / positive.
- **XSS / CSRF:** not applicable — this is a JSON-only API (`Content-Type: application/json`) that
  renders no HTML, and auth is header-based (`x-api-key`), not cookie-based, so there is no CSRF
  ambient-authority surface and no HTML sink for stored/reflected XSS in the reviewed code.

## Out-of-Scope Observations

Noticed while tracing data flow; **not** regressions from Ticket 001 (these files were not changed):

- **`src/middleware/auth.js:1` — hardcoded admin API key.** `const ADMIN_API_KEY = 'sk-demo-admin-key-12345';`
  is a credential committed as a literal, gating `DELETE /expenses` (`server.js:61-64`). In a real
  deployment this would be HIGH; here it is pre-existing and outside this ticket's scope. Should be
  moved to an environment variable / secret store.
- **`src/middleware/auth.js:5` — non-constant-time key comparison.** `providedKey === ADMIN_API_KEY`
  is short-circuiting and technically leaks timing; for a shared static key over HTTP this is
  low practical risk. Consider `crypto.timingSafeEqual`. Out of scope.
- **Unauthenticated read/export routes.** `GET /expenses`, `/expenses/summary`, and `/expenses/export`
  require no auth (`server.js:40-59`); only `DELETE` is gated. This appears to be the app's intended
  design and is unrelated to Ticket 001. Noted only so it isn't mistaken for a fix-introduced gap.

## References (files opened during this review)

- `context/bugs/001/fix-summary.md` — authoritative changed-files list and manual-test steps
- `context/bugs/001/research/verified-research.md` — prior verification context
- `src/utils/exportUtil.js` — Change 3 (SEC-001), reviewed in full
- `src/services/expenseService.js` — Changes 1 & 2 (BUG-001, BUG-002), reviewed in full
- `src/server.js` — traced both routes that invoke the changed code (export input source, summary)
- `src/middleware/auth.js` — out-of-scope observations (data-flow trace of DELETE route)
- `tests/expenseService.test.js` — corroborated BUG-001/BUG-002 remediation
- `package.json` — dependency review (zero deps; confirmed test command `npm test`)
