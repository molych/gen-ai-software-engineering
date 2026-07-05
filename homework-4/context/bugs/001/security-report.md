# Security Report — Ticket 001

**Executed by (role):** Security Vulnerabilities Verifier (stage 5)
**Pipeline position:** Bug Fixer → **[Security Verifier]** → Unit Test Generator
**Input authority:** `context/bugs/001/fix-summary.md` (Bug Fixer's authoritative changed-files list)

---

## Scope

**Changed files reviewed in full (primary scope, per `fix-summary.md`):**

- `src/services/expenseService.js` — Change 1 (line 35, `getSummary` average) and Change 2
  (line 25, `getExpensesByCategory` comparison).
- `src/utils/exportUtil.js` — Change 3 (SEC-001: removal of the `child_process.exec` shell-out,
  addition of the `SAFE_FILENAME_PATTERN` allow-list and `fs.copyFile`).

**Data-flow tracing (read to establish where external input originates):**

- `src/server.js` — the HTTP layer that calls into both changed files. Established that
  `filename` originates from the **query string** of `GET /expenses/export`
  (`searchParams.get('filename')`, defaulting to `'expenses.csv'`), and that `description` /
  `amount` / `category` originate from the **JSON body** of `POST /expenses` (`readBody` →
  `JSON.parse`), neither of which is authenticated.
- `src/middleware/auth.js` — opened while tracing the one authenticated route
  (`DELETE /expenses`). Findings there are reported under **Out-of-Scope Observations** (not a
  changed file).

**Verification environment:**

- Node `v20.18.3`, macOS (Darwin).
- `npm test` (from `homework-4/`) → **5 pass, 0 fail** (suite is green).
- Two throwaway probe scripts run **outside** the repo (in the OS temp dir), exercising the real
  functions with attack payloads. No file under review was modified; nothing was written into the
  app's `exports/` directory; the repo working tree is clean. The filename/path probe used a
  faithful copy of the export logic pointed at a disposable temp `EXPORTS_DIR` (so no repo writes),
  while the CSV-escaping and input-validation probes required the **real** modules and called only
  their pure / in-memory functions (`toCsv`, `addExpense`, `getSummary`, `reset`).

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 2 |
| LOW      | 2 |
| INFO     | 3 |

**Originally-fixed vulnerability (SEC-001, command injection):** **Confirmed remediated.** The
`child_process.exec` shell-out is gone (no `exec`/`spawn`/`child_process` remains anywhere in
`src/`), and every shell-metacharacter / path-traversal payload I threw at the new allow-list was
rejected; a "secret" file planted outside the export directory was left untouched. See **INFO-1**
for the evidence.

The two functional fixes (BUG-001 average, BUG-002 category filter) introduced **no security
regression** (INFO-2, INFO-3). The findings below are pre-existing weaknesses in the changed files
surfaced by a full-file review, plus one fragility in the new SEC-001 allow-list itself.

---

## Findings

### MEDIUM-1 — Filename allow-list permits dot-only path tokens (`.`, `..`); mitigation is incomplete/fragile
- **File:** `src/utils/exportUtil.js:15` (`SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/`), applied at
  `:18`, consumed at `:25`.
- **Category:** Injection (path / directory traversal) / Missing validation.
- **Description:** The allow-list includes `.` in the character class with no additional guard, so
  the pattern matches the path-navigation tokens `.` and `..` (and `...`). The value then flows to
  `path.join(EXPORTS_DIR, path.basename(filename))`. The control is doing **less than it appears**:
  it is meant to guarantee a safe in-directory filename, but it accepts strings whose meaning is
  "the current / parent directory."
- **How it was verified:** Probe over 16 payloads.
  - `..` → passes the regex; `path.join(EXPORTS_DIR, '..')` resolves to the **parent** of the
    exports directory; the subsequent copy fails with `EISDIR` (destination is a directory) — so it
    does **not** escape, but only by accident of the copy target being a directory.
  - `.` → passes; resolves to `EXPORTS_DIR` itself → `EISDIR`.
  - `...` → passes; writes a file literally named `...` **inside** exports (stays in-bounds).
  - `.staging.csv` → passes; resolves onto the module's own `TMP_FILE` staging path (harmless
    clobber with identical content).
  - Real traversal payloads (`../../etc/passwd`, `foo/bar`, `foo\bar`) are **rejected** because `/`
    and `\` are not in the class, and `path.basename` would strip them anyway. A file planted
    outside the export dir survived every payload intact.
- **Actual exploitability:** **None demonstrated today** — no payload escaped `EXPORTS_DIR` or
  overwrote a sensitive file. The severity is **MEDIUM per the "incomplete/fragile mitigation"**
  clause of the scale, not per exploited impact: the allow-list's safety currently rests entirely
  on incidental downstream behavior (`/` being excluded, `path.basename`, and `..` happening to
  land on a directory that errors) rather than on the validation itself. A later refactor — e.g.
  writing into a subdirectory, or changing the copy target — would turn this latent gap into a real
  traversal.
- **Remediation:** Tighten the allow-list to reject bare `.`/`..` and require a real extension,
  e.g. `/^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9]+$/` and an explicit
  `if (['.', '..'].includes(filename)) reject`. As defense-in-depth, resolve the destination and
  assert it stays inside `EXPORTS_DIR`:
  `const dest = path.resolve(EXPORTS_DIR, path.basename(filename)); if (!dest.startsWith(EXPORTS_DIR + path.sep)) return callback(new Error('Invalid filename'));`

### MEDIUM-2 — CSV / formula injection in `toCsv` (unescaped user-controlled fields)
- **File:** `src/utils/exportUtil.js:9-11` (row mapping in `toCsv`).
- **Category:** Injection (CSV / spreadsheet-formula) — the "rendered elsewhere" analog of XSS for
  this JSON API.
- **Description:** `description` and `category` come from the unauthenticated `POST /expenses` body
  and are interpolated straight into CSV rows with no escaping. An attacker can (a) break the CSV
  column/row structure with commas and newlines, and (b) inject spreadsheet formulas that execute
  when the exported file is opened in Excel/Sheets/LibreOffice (formula/CSV injection).
- **How it was verified:** Called the **real** `exportUtil.toCsv` with crafted rows:
  - `description = '=HYPERLINK("http://evil","clickme")'` → emitted verbatim (formula cell,
    unescaped).
  - `description = 'Lunch, with comma'` → the comma shifts subsequent columns.
  - `description = 'line1\nINJECTED-ROW,9,evil'` → the newline injects an entirely new CSV row.
  All three were confirmed present in the generated output.
- **Actual exploitability:** Requires a victim to open the exported CSV in a spreadsheet app;
  self-contained data-integrity breakage (comma/newline) needs no victim. Standard MEDIUM for
  formula injection.
- **Remediation:** RFC-4180-escape every field (wrap any field containing `,`, `"`, `\n`, or `\r`
  in double quotes and double embedded quotes), and neutralize leading formula triggers by
  prefixing a value that begins with `=`, `+`, `-`, `@`, `\t`, or `\r` with a single quote.

### LOW-1 — No input validation in `addExpense`; non-numeric `amount` corrupts `getSummary` (and the export)
- **File:** `src/services/expenseService.js:4-13` (`addExpense`), impact realized at `:33-35`
  (`getSummary` reduce/average).
- **Category:** Missing validation (unchecked type/shape of external input that later feeds a
  calculation).
- **Description:** `addExpense` stores `description` / `amount` / `category` from the
  unauthenticated `POST /expenses` body with no type/shape checks. A non-numeric `amount` poisons
  the `total` reducer and the average.
- **How it was verified:** Ran the **real** service in-memory. After adding one valid expense plus
  `amount: 'abc'`, `amount: undefined`, and `amount: { $gt: 0 }`,
  `getSummary()` returned `{"total":"10abcundefined[object Object]","count":4,"average":null}`
  (`average` is `NaN`, which serializes to JSON `null`). A single `amount: 'NaNstr'` gave
  `{"total":"0NaNstr","count":1,"average":null}`. So any anonymous request can make
  `GET /expenses/summary` return a garbage `total` and a `null` average for all subsequent callers
  until `reset`.
- **Relation to the fix:** Change 1 correctly guards the `count === 0` divide-by-zero case, but the
  average is still `NaN`/garbage whenever a stored `amount` is non-numeric — a validation gap one
  function upstream of the code that was fixed. Rated **LOW** (integrity-only, in-memory,
  non-persistent across restart, no compromise / disclosure / privilege impact), though it is
  arguably MEDIUM given it is triggerable by a single unauthenticated request and degrades a shared
  endpoint's output.
- **Remediation:** In `addExpense`, validate `typeof amount === 'number' && Number.isFinite(amount)`
  and that `description` / `category` are strings, rejecting otherwise (surface a 400 at the HTTP
  layer). This also hardens the CSV export (MEDIUM-2) against non-string fields.

### LOW-2 — Shared module-level staging file (`.staging.csv`) races across concurrent exports
- **File:** `src/utils/exportUtil.js:5` (`TMP_FILE` constant), `:24` (`fs.writeFileSync(TMP_FILE, …)`),
  `:26` (`fs.copyFile(TMP_FILE, destination, …)`).
- **Category:** Race condition on a shared temp file between concurrent async callbacks.
- **Description:** Every export writes the same single module-level `TMP_FILE` and then
  asynchronously copies it to the destination. Two overlapping export requests race on that one
  shared path: request A can copy the CSV that request B just wrote into A's destination file.
- **Actual exploitability:** **Negligible today** — every export serializes the identical global
  expense list, so whichever content wins the race is byte-for-byte the same. The finding is the
  fragile pattern: if exports ever become request-specific (e.g. a per-category or per-user
  export), this becomes a cross-request data-leak/corruption. Rated **LOW**.
- **Remediation:** Use a unique per-request temp path (`fs.mkdtempSync` / `os.tmpdir()` + random
  suffix) and unlink it after the copy, or write the CSV directly to the destination and skip the
  staging file entirely.

### INFO-1 — SEC-001 command injection confirmed remediated
- **File:** `src/utils/exportUtil.js:1-2` (imports), `:26` (`fs.copyFile`).
- **Description / verification:** The pre-fix code ran ``exec(`cp ${TMP_FILE} ${destination}`)`` with
  an unsanitized request filename — a textbook command injection. Confirmed independently of the
  fix-summary: `grep -rniE "child_process|exec\(|execSync|spawn|eval\(|new Function" src/` returns
  **no matches**; the copy now uses `fs.copyFile` (no shell). Payloads
  `out.csv; touch /tmp/pwned`, `$(whoami)`, `` `id` ``, and newline-embedded commands were all
  **rejected** by `SAFE_FILENAME_PATTERN`, and a control file placed outside the export directory
  was never modified. A common allow-list pitfall (the `$`-anchor matching before a trailing
  newline, as in Ruby/PHP) does **not** apply here — JavaScript's `$` without the `m` flag is
  strict, and `SAFE_FILENAME_PATTERN.test('out.csv\n')` returned `false`.

### INFO-2 — BUG-001 (average) fix introduces no security regression
- **File:** `src/services/expenseService.js:35`.
- **Description:** `count === 0 ? 0 : total / count` removes the divide-by-`(count - 1)` /
  divide-by-zero defect. No injection, secret, or comparison concern. (The residual non-numeric
  `amount` gap is tracked separately as LOW-1.)

### INFO-3 — BUG-002 (category filter) fix introduces no security regression
- **File:** `src/services/expenseService.js:25`.
- **Description:** The prior `if (expense.category = category)` was an assignment that mutated
  stored state and always matched; it is now a strict-equality **comparison** (`===`). Strict
  equality is the correct choice here (avoids `==` type-coercion surprises), and `category` from the
  query string is always a string. No security concern remains.

### Explicit category coverage for the changed files
- **Injection — command:** remediated (INFO-1). **path:** MEDIUM-1. **CSV/template:** MEDIUM-2.
  **SQL/NoSQL:** not applicable — the store is an in-memory JS array (`expenseService.js`), no
  database or query language.
- **Hardcoded secrets:** none in the two changed files. (A hardcoded key exists in `auth.js` — see
  Out-of-Scope Observations.)
- **Insecure comparisons:** not applicable to the changed files — `expenseService.js` uses strict
  `===`, and neither changed file compares a secret/token (the only secret comparison lives in
  `auth.js`, out of scope).
- **Missing validation:** LOW-1 (`addExpense` types) and MEDIUM-1 (filename shape).
- **Unsafe dependencies:** none — `package.json` declares **zero** runtime dependencies, and the fix
  *removed* the ad-hoc `cp` shell-out in favor of a stdlib `fs.copyFile` call (a net improvement).
- **XSS / CSRF:** not applicable — this is a JSON-only API with header-based auth (`x-api-key`); it
  renders no HTML and uses no cookie-based sessions. The browser-facing injection risk for this app
  is spreadsheet-formula injection via the CSV export, which is captured as MEDIUM-2.

---

## Out-of-Scope Observations

These are in `src/middleware/auth.js` and `src/server.js`, which are **not** changed files for this
ticket. They are pre-existing and are **not** regressions from the Bug Fixer's work — flagged only
because they were encountered while tracing data flow into the changed files.

- **OOS-1 (auth.js:1) — Hardcoded admin API key.** `const ADMIN_API_KEY = 'sk-demo-admin-key-12345';`
  is a credential committed as a source literal. Move it to configuration/secret storage
  (`process.env`), and fail closed if it is unset. (Marked "demo" in the value, so likely intentional
  for the homework, but noted per the hardcoded-secrets category.)
- **OOS-2 (auth.js:5) — Non-constant-time key comparison.** `providedKey === ADMIN_API_KEY` short-
  circuits on the first differing byte, a timing side-channel against the key. Use
  `crypto.timingSafeEqual` over fixed-length buffers (with a length guard).
- **OOS-3 (server.js:52-59, 34-46) — Export / read / write endpoints are unauthenticated.** Only
  `DELETE /expenses` is gated by `requireAdmin`; `POST /expenses`, `GET /expenses*`, and
  `GET /expenses/export` accept anonymous requests. That means any anonymous caller can create files
  in `exports/` (disk-fill DoS) and dump the full expense list to a file, and can trigger the
  data-integrity issues in LOW-1 / MEDIUM-2. Consider authenticating state-changing and
  file-producing routes, and rate-limiting the export.

---

## References

Files opened during this review:

- `agents/security-verifier.agent.md` (role specification)
- `context/bugs/001/fix-summary.md` (authoritative changed-files list)
- `context/bugs/001/bug-context.md` (reported symptoms)
- `src/services/expenseService.js` (changed — reviewed in full)
- `src/utils/exportUtil.js` (changed — reviewed in full)
- `src/server.js` (HTTP layer / data-flow source — traced)
- `src/middleware/auth.js` (auth helper — traced for the one authenticated route; out-of-scope)
- `tests/expenseService.test.js` (test suite exercised via `npm test`)
- `package.json` (dependency / script review)

Verification commands: `npm test`; `grep -rniE "child_process|exec\(|execSync|spawn|eval\(|new Function" src/`;
two Node probe scripts run in the OS temp dir (filename/path allow-list over 16 payloads against a
disposable `EXPORTS_DIR`; real-module `toCsv` escaping and `addExpense`/`getSummary` validation
in-memory). Repo working tree left clean; nothing written to the app's `exports/` directory.
