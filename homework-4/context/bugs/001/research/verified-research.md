# Verified Research — Ticket 001

**Verifier (role):** Bug Research Verifier
**Document under review:** `context/bugs/001/research/codebase-research.md`
**Rubric applied:** `skills/research-quality-measurement.md`
**Traceability input:** `context/bugs/001/bug-context.md`

---

## Verification Summary

- **Pass/Fail line:** **FAIL** — do not forward to the Bug Planner as-is. Send back for another
  research pass.
- **Research Quality level:** **POOR** (per skill Section 3).

Why: the line-number citations are all accurate (Reference Accuracy 100%), but two of the three
quoted snippets misrepresent the source logic and the SEC-001 data-flow claim describes the wrong
request path. Snippet Fidelity is only 33% and there are 3 material defects (either condition alone
forces POOR). The findings are *directionally* pointing at the right three lines, but every
substantive detail a downstream fixer would act on (the exact operator, the actual root cause, the
attack vector) is wrong in at least one finding.

Findings carrying material defects (must be re-researched before anyone plans a fix):
- **BUG-002** — quoted as loose equality `==`; the source is actually an **assignment** `=`.
- **SEC-001** — attack vector described as `POST` JSON **body**; the source reads it from the
  **GET query string**.
- **BUG-001** — quoted snippet reproduces the *corrected* expression, not the buggy source.

---

## Verified Claims

| # | Claim (short) | Cited location | Reference Accuracy | Snippet Fidelity | Verdict |
|---|---|---|---|---|---|
| BUG-001 | `getSummary` average uses wrong denominator | `src/services/expenseService.js:36` | **Near-miss** (code at line 35) | **Mismatched** (source: `total / (count - 1)`) | Discrepancy (Material) |
| BUG-002 | Category filter uses loose equality `==` | `src/services/expenseService.js:25` | **Exact** | **Mismatched** (source: `=` assignment) | Discrepancy (Material) |
| SEC-001 | `exec` shell-out with unsanitized filename | `src/utils/exportUtil.js:20` | **Exact** | **Exact** | Snippet verified; **data-flow claim Wrong (Material)** |
| SEC-001 (data flow) | `filename` comes from JSON body of `POST /expenses/export` | `src/server.js` | **Wrong** | N/A (no snippet) | Discrepancy (Material) |
| OBS-auth | `auth.js` hardcodes an API key literal | `src/middleware/auth.js` (no line) | **Exact** (literal at line 1) | N/A (no snippet) | Verified accurate |

Corroboration run: `npm test` (pre-fix) — subtests 2, 3, 4 fail; subtest 1 passes. The observed
failures (`getExpensesByCategory` returns 3 of 3; `getSummary` average = 30 for [10,20,30]; average
= `-0` on empty) independently confirm the *behavior* described in BUG-001 and BUG-002 while
disproving the *snippets* quoted for them (see Discrepancies).

---

## Discrepancies Found

### D1 — BUG-001 snippet quotes the corrected code, not the source (Material)

- **Claimed:** snippet `const average = total / count;` at `expenseService.js:36`.
- **Source:** line **35** reads `const average = total / (count - 1);`. Line 36 is
  `return { total, count, average };`.
- **Two issues:**
  1. *Reference Accuracy — Near-miss:* the average computation is on line 35, cited as 36 (off by
     one, within the ±3 tolerance). Cosmetic on its own.
  2. *Snippet Fidelity — Mismatched:* the quoted `total / count` is the **fixed** expression, not
     the buggy source `total / (count - 1)`. Proven by `npm test`: for [10,20,30] the average comes
     back as **30** (`60 / (3-1)`), and on an empty account as **-0** (`0 / (0-1)`); a real
     `total / count` would yield 20 and `NaN`/0 respectively.
- **Material** because a reader who trusts the snippet (the Bug Fixer patches the quoted line)
  would conclude the average line is already `total / count` and needs no change — the exact
  opposite of reality. Mitigating note: the finding's prose Description ("wrong denominator...
  subtracts 1") and Suggested root cause ("divide by the plain count") *are* correct, so a reader
  who ignores the snippet and reads the prose still reaches the right cause. The defect is in the
  load-bearing snippet, so it is still counted Material.

### D2 — BUG-002 is an assignment bug, not a loose-equality bug (Material)

- **Claimed:** snippet `if (expense.category == category) {` at `expenseService.js:25`;
  Description: "uses loose equality (`==`) instead of strict equality (`===`)... type coercion...
  can make unrelated categories compare as equal"; Suggested root cause: "replace `==` with `===`".
- **Source:** line **25** reads `if (expense.category = category) {` — a single `=`, i.e. an
  **assignment**, not a comparison.
- **Reference Accuracy — Exact** (line 25 is correct). **Snippet Fidelity — Mismatched** (`==` vs
  `=` is a different operator, the most serious snippet class).
- **Material** because the diagnosis is wrong, not just the character:
  - The real mechanism is that `expense.category = category` **assigns** the requested category to
    every expense visited and evaluates truthy, so the filter returns *all* expenses **and mutates
    the stored data**. This exactly matches bug-context symptom 2's second half ("previously-
    'transport' expenses show up as 'food' on subsequent unfiltered calls — the data itself appears
    to change") — which the research document does not explain at all.
  - The "type coercion / loose equality" story is a misdiagnosis; no coercion is involved.
  - `npm test` confirms: the `...without mutating others` subtest fails with `3 !== 2` (all three
    expenses matched), and its second assertion targets the mutation the doc missed.
  - The suggested fix ("replace `==` with `===`") would coincidentally produce correct code, but
    it is prescribed for the wrong reason and would leave a planner unaware of the data-corruption
    dimension.

### D3 — SEC-001 attack vector points at the wrong request path (Material)

- **Claimed:** "`filename` originates from the JSON body of the `POST /expenses/export` request in
  `src/server.js`."
- **Source (`src/server.js:52-53`):** the route is `req.method === 'GET' && pathname ===
  '/expenses/export'`, and `const filename = searchParams.get('filename') || 'expenses.csv';` —
  the filename is read from the **URL query string of a GET request**, not from a JSON body, and
  the verb is **GET**, not POST. (`readBody`/JSON parsing at lines 14-27 is never invoked for this
  route.) This also contradicts bug-context symptom 3, which correctly says `GET /expenses/export`.
- **The vulnerable line itself is verified:** `exportUtil.js:20`
  `exec(`cp ${TMP_FILE} ${destination}`, (error, stdout, stderr) => {` matches the source exactly,
  and `destination` is indeed built from the caller-supplied `filename` (`exportUtil.js:19`) with
  no sanitization. The command-injection root cause and the suggested fix (`fs.copyFileSync` +
  allow-list) are sound.
- **Material** because acting on the claim as written mis-routes reproduction: a Security Verifier
  would craft `POST /expenses/export` with body `{"filename": "; rm -rf /"}`, which hits **no route**
  (POST /expenses/export is unhandled → 404) and never reads the body — the exploit would appear to
  fail. The working vector is `GET /expenses/export?filename=<payload>`. Per the skill, a wrong
  request path/verb for the tainted input is a Material defect even though the vulnerability and fix
  are correctly identified.

### Non-discrepancies (verified accurate)

- **SEC-001 snippet** (`exportUtil.js:20`) — Exact match.
- **BUG-002 / BUG-001 line references** — both land on (or within one line of) the described code.
- **Additional Observation** — `src/middleware/auth.js:1` does hardcode
  `const ADMIN_API_KEY = 'sk-demo-admin-key-12345';`; the observation is accurate and correctly
  scoped out of this ticket.
- **Reference to `tests/expenseService.test.js`** — file exists; failing subtests do corroborate
  the *symptoms* of BUG-001 and BUG-002 as claimed.

---

## Research Quality Assessment

**Level: POOR → FAIL** (skill Section 3 / Section 4).

Aggregate metrics (skill Section 2), computed over 4 references and 3 quoted snippets:

```
References (4): BUG-001 (Near-miss), BUG-002 (Exact), SEC-001 (Exact), OBS-auth (Exact)
Reference Accuracy %  = (Exact + Near-miss) / Total = (3 + 1) / 4 = 100%

Snippets (3):   BUG-001 (Mismatched), BUG-002 (Mismatched), SEC-001 (Exact)
Snippet Fidelity %    = (Exact + Paraphrased) / Total = (1 + 0) / 3 = 33.3%

Material Defect Count = 3
  - BUG-001 snippet  (Mismatched + Material)  [D1]
  - BUG-002 snippet  (Mismatched + Material)  [D2]
  - SEC-001 data flow (Wrong + Material)      [D3]
```

Level selection (lowest level satisfied by all three conditions; Material Defect Count is a hard
gate):
- Reference Accuracy 100% would allow EXCELLENT on that axis alone.
- Snippet Fidelity 33.3% is **below 70%**, which by itself forces **POOR** (Section 3, POOR row:
  "< 70% (either axis)").
- Material Defect Count = 3 (**≥ 2**) independently forces **POOR** and blocks FAIR (FAIR allows
  ≤ 1 material defect only).
- Not **UNRELIABLE**: every cited file exists and no reference is Wrong on location (Reference
  Accuracy is 100%, so citations are not "Wrong often enough" and there is no majority-Wrong case).

The score is driven by D1, D2, and D3 specifically. Even under the most lenient reading — treating
D1's snippet as Cosmetic because the finding's prose still names the right root cause — the document
still lands at POOR, because D2 and D3 alone are 2 material defects (≥ 2 gate) and Snippet Fidelity
would still be 33%. The conclusion (FAIL) is therefore robust to that judgment call.

**What the Bug Planner must not trust from the original document:**
1. The BUG-002 diagnosis ("loose equality / coercion") — the actual bug is an assignment `=` with a
   data-mutation side effect; plan for both the wrong-result and the data-corruption symptoms.
2. The SEC-001 attack vector — it is `GET /expenses/export?filename=…` (query string), not a POST
   JSON body.
3. The BUG-001 snippet — the current source divides by `(count - 1)` (and yields `-0` on empty),
   not `total / count`.

The line numbers, the SEC-001 vulnerable line/snippet, the fix directions, and the auth observation
are reliable.

---

## References

Files opened and checked line-by-line during this verification:

- `context/bugs/001/research/codebase-research.md` (document under review)
- `context/bugs/001/bug-context.md` (traceability)
- `skills/research-quality-measurement.md` (rubric)
- `src/services/expenseService.js` (BUG-001 line 35, BUG-002 line 25)
- `src/utils/exportUtil.js` (SEC-001 lines 16-20)
- `src/server.js` (SEC-001 data-flow trace, lines 40-59; `readBody` lines 14-27)
- `src/middleware/auth.js` (Additional Observation, line 1)
- `tests/expenseService.test.js` (corroboration)
- `npm test` output (pre-fix run: subtests 2, 3, 4 fail — confirms BUG-001/BUG-002 symptoms and the
  `(count - 1)` denominator / all-match behavior)
