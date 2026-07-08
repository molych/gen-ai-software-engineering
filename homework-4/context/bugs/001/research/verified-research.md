# Verified Research — Ticket 001

**Author (role):** Bug Research Verifier
**Input under review:** `context/bugs/001/research/codebase-research.md`
**Skill applied:** `skills/research-quality-measurement.md`

---

## Verification Summary

- **Gate:** **FAIL** — send back for another research pass before anyone plans a fix from it.
- **Research Quality level:** **POOR**.
- **One-line reason:** Two of the three findings quote snippets whose logic differs from the
  source (Snippet Fidelity 33%), and there are **≥ 2 material defects** — BUG-002 misidentifies
  the operator and therefore the entire root cause, and SEC-001 sends a reader to the wrong
  request path (POST/JSON body vs. the actual GET/query string). SEC-001's core vulnerability
  claim is real and correctly cited, but the finding as written would misdirect reproduction.

---

## Verified Claims

| # | Claim (finding) | Cited location | Reference Accuracy | Snippet Fidelity | Verdict |
|---|---|---|---|---|---|
| 1 | BUG-001: `getSummary` uses wrong denominator for `average` | `expenseService.js:36` | **Near-miss** (code is at line 35; line 36 is the `return`) | **Mismatched** (quoted `total / count`; source is `total / (count - 1)`) | Root-cause prose correct; quoted snippet shows the *fixed* code, not the source |
| 2 | BUG-002: category filter matches everything via loose equality | `expenseService.js:25` | **Exact** | **Mismatched** (quoted `==`; source is `=` assignment) | **Material defect** — wrong operator → wrong mechanism → fix would not address real bug |
| 3 | SEC-001: shell command built from unsanitized filename (`exec` line) | `exportUtil.js:20` | **Exact** | **Exact** | Vulnerability real and correctly cited character-for-character |
| 4 | SEC-001: data-flow — `filename` comes from the JSON body of `POST /expenses/export` | `src/server.js` (input path) | **Wrong** (actual: `GET /expenses/export`, `searchParams.get('filename')` — query string) | n/a (no snippet quoted) | **Material defect** — wrong method + wrong input source misdirects repro/severity |
| 5 | Additional Observation: API key hard-coded as a literal string | `src/middleware/auth.js` | **Exact** (line 1: `const ADMIN_API_KEY = 'sk-demo-admin-key-12345';`) | n/a | Accurate; explicitly flagged out-of-scope by the researcher |

---

## Discrepancies Found

**1. BUG-001 — citation off by one line + snippet shows corrected code (Material).**
- *Claimed:* line 36, snippet `const average = total / count;`.
- *Source:* line **35** reads `const average = total / (count - 1);`; line 36 is
  `return { total, count, average };`.
- *Why it matters:* The quoted snippet is the **correct** version — it omits the `- 1` that *is*
  the bug. A reader who trusts the snippet over the source (which this stage assumes downstream
  consumers do) would conclude the average is computed correctly and there is nothing to fix.
  The finding's prose ("the denominator expression subtracts 1 from the count") does correctly
  describe the bug, which mitigates the risk — but the snippet contradicts the source on the one
  token that constitutes the defect. **Material.**

**2. BUG-002 — wrong operator, wrong mechanism, wrong fix (Material).**
- *Claimed:* `if (expense.category == category) {` — loose equality; over-matching attributed to
  type coercion; suggested fix "replace `==` with `===`".
- *Source (line 25):* `if (expense.category = category) {` — a single-`=` **assignment**, not a
  comparison.
- *Why it matters:* The real defect is an assignment inside the filter predicate, which (a) always
  evaluates to a truthy value → every expense matches, and (b) **mutates** `expense.category` to
  the requested value. This exactly explains *both* halves of reported symptom (2), including
  "previously-transport expenses show up as food … the data itself appears to change" — which the
  research does not mention at all. The stated mechanism (type coercion) is wrong, and the
  suggested fix (`==` → `===`) targets an operator that isn't in the code; a literal find-replace
  of `==` would change nothing. `tests/expenseService.test.js:19` ("returns only matching expenses
  **without mutating others**") independently confirms the mutation the research missed. **Material.**

**3. SEC-001 — wrong request path / input source (Material).**
- *Claimed:* "`filename` originates from the JSON body of the `POST /expenses/export` request in
  `src/server.js`."
- *Source (`server.js:52-53`):* the route is `GET /expenses/export`, and `filename` comes from
  `searchParams.get('filename')` — the **URL query string**, not a JSON body; the method is
  **GET**, not POST. `bug-context.md` symptom (3) likewise describes it as `GET /expenses/export`.
- *Why it matters:* The command-injection vulnerability itself is real and the `exec` line is
  cited exactly (finding #3). But a Security Verifier attempting to reproduce via a POST JSON body
  `{"filename": "; rm -rf /"}` would fail, because the code ignores the body entirely. The working
  vector is `GET /expenses/export?filename=<payload>`. A wrong request path in a security finding
  headed for severity assessment is material. **Material.**

*No other discrepancies:* SEC-001's `exec` citation (#3) and the auth.js observation (#5) checked
out exactly and are not discrepancies.

---

## Research Quality Assessment

**Level: POOR → Gate: FAIL.**

Metrics (per skill Section 2, computed over the 5 references above):

```
Reference Accuracy %  = (Exact + Near-miss) / Total
                      = (3 Exact + 1 Near-miss) / 5 = 80%
Snippet Fidelity %    = (Exact + Paraphrased) / Total snippets quoted
                      = (1 Exact + 0 Paraphrased) / 3 = 33%
Material Defect Count = 3  (BUG-001 snippet, BUG-002 snippet, SEC-001 data-flow)
```

Level selection (skill Section 3, taking the lowest level satisfied):
- **Snippet Fidelity 33% is far below the 70% POOR threshold** on its own → caps at POOR.
- **Material Defect Count ≥ 2** independently forces POOR (the material-defect hard gate).
- Not UNRELIABLE: every cited file exists and the majority of citations are not Wrong (3 Exact,
  1 Near-miss, 1 Wrong of 5).

The score is driven by specific findings, not a general impression:
- **BUG-002** is the most damaging: the single-vs-double `=` error inverts the diagnosis (assignment
  vs. comparison) and drops the data-mutation symptom entirely — the fix as written would not work.
- **SEC-001's data-flow claim** points reproduction at the wrong HTTP method and input source.
- **BUG-001's snippet** presents the corrected line as if it were the buggy source.

Note: even if BUG-001's snippet mismatch were judged Cosmetic (its prose does diagnose correctly),
the level remains POOR — BUG-002 and SEC-001 still constitute two independent material defects, and
Snippet Fidelity (33%) alone already fails the POOR threshold.

**Guidance for the Bug Planner:** Do not plan from this document as-is. At minimum, re-research
BUG-002 (confirm `=` vs `==`/`===` and the mutation behavior) and SEC-001's input path (GET query
string). BUG-001's root cause is trustworthy from the prose; correct the line number (35, not 36)
and disregard the misleading snippet.

---

## References (files opened during verification)

- `context/bugs/001/research/codebase-research.md` — document under review
- `skills/research-quality-measurement.md` — scoring procedure
- `context/bugs/001/bug-context.md` — ticket symptoms / scope (traceability check: present, matches)
- `src/services/expenseService.js` — verified BUG-001 (line 35) and BUG-002 (line 25)
- `src/utils/exportUtil.js` — verified SEC-001 `exec` line (line 20)
- `src/server.js` — traced SEC-001 data flow one hop upstream (lines 52-53)
- `src/middleware/auth.js` — verified Additional Observation (line 1)
- `tests/expenseService.test.js` — corroborated BUG-002 mutation symptom (line 19) and BUG-001/2 test coverage
