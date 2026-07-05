# Skill: Unit Tests — FIRST

**Used by:** `agents/unit-test-generator.agent.md` (and any future agent generating tests in this
repo).

**Purpose:** A generated test that's merely "green" isn't good enough — it also has to be
trustworthy to run again next week, in CI, next to a hundred other tests, without anyone babysitting
it. FIRST is the checklist that separates a test worth keeping from one that will be quarantined or
deleted the first time it's flaky.

This project's test framework is Node's built-in test runner: `node:test` + `node:assert/strict`,
run via `npm test` (= `node --test tests/`). Every rule below is phrased against that framework.

---

## The Five Properties

### F — Fast
A unit test proves something in milliseconds. If it needs a real sleep, a real network call, or a
multi-second timeout to pass, it's testing the wrong layer.
- No `setTimeout`/real delays to "wait for" something — if the code under test is async, `await`
  its actual promise/callback instead of guessing a delay.
- No real HTTP calls (don't spin up `src/server.js` and hit it over a socket to test a service
  function — call the exported function directly).
- Local, small-file disk I/O (e.g. this project's `fs.writeFileSync`/`fs.copyFile` calls) is
  acceptable — it's still sub-millisecond on a local disk — but don't generate large fixtures or
  loop hundreds of times where a handful of cases prove the point.

### I — Independent
A test must not depend on another test having run first, and must not leave state that changes a
later test's outcome.
- `expenseService` holds module-level state (`expenses`, `nextId`). Every test (or `beforeEach`)
  must call `reset()` before asserting, exactly like the existing suite already does — never rely
  on IDs or array contents left over from a previous test.
- If a test writes a real file (e.g. via `exportExpensesToFile`), it must use a filename unlikely
  to collide with other tests (or a fixed name it deletes in `afterEach`) so two tests — or two
  runs — don't clobber each other's evidence.
- Tests in the same file must pass individually (`node --test tests/foo.test.js -t "test name"`)
  and as a full run, in any order.

### R — Repeatable
Same result, every machine, every run — no dependence on wall-clock time, real randomness, ambient
files outside the test's control, or execution order.
- Clean up any file a test creates (`afterEach`/`after` with `fs.rmSync`/`fs.unlinkSync`), so a
  second run of the suite starts from the same state as the first, and so generated artifacts don't
  leak into the repo.
- Don't assert on real `Date.now()`/timestamps unless the code under test is given a fixed input;
  don't assert on the exact wording of OS-level error messages (assert on `error.code` or a
  substring you control, not a full OS/locale-dependent string).
- If a test intentionally exercises a real file path, use a path under `exports/` (or the OS temp
  dir if the module allows it) that the test itself creates and destroys — never assume a file
  from a previous manual run is sitting there.

### S — Self-validating
The test itself decides pass/fail via an assertion — a human should never need to read console
output and judge whether it "looks right."
- Every test ends in `assert.*` (from `node:assert/strict`), never a bare `console.log` of a
  result.
- Assert the specific value changed by the fix (e.g. `average`, filtered length, rejected vs.
  accepted filename), not just "did not throw" — a test that only checks "no exception" would have
  passed against the original buggy code too.

### T — Timely
Tests are written right when the code changes, covering exactly what changed — not "someday" once
the context is gone.
- Scope new tests to the code actually listed as changed in `fix-summary.md`. Don't write sweeping
  new coverage for unrelated, untouched functions in the same file — that's a different ticket's
  job and dilutes "timely" into "unscoped."
- A test that would have failed against the pre-fix code and passes against the post-fix code is
  the strongest evidence the fix (and the test) are both timely and real — prefer writing tests
  that pin down the specific before/after behavior from the fix, not generic smoke tests.

---

## How to Apply This Skill

For every test file you generate:

1. Import `node:test` and `node:assert/strict`, matching the existing suite's style.
2. Reset any shared/module-level state in `beforeEach` (Independent).
3. If the test touches the real filesystem, clean up in `afterEach`/`after` and use a
   collision-resistant filename (Independent + Repeatable).
4. Assert on the exact value the change affects, not just "it ran" (Self-validating).
5. Keep the test scoped to the function(s) named in `fix-summary.md`'s Changes Made section
   (Timely) — do not expand into unrelated, unchanged functions.
6. Run the suite (`npm test`) and confirm the new tests actually pass, and that you did not
   regress any previously-passing test.
7. When writing the result report, state explicitly, per test file, which of the five properties
   could be a concern and how the test handles it (e.g. "writes a real file — cleaned up in
   `afterEach`") — don't just assert "FIRST-compliant" with no reasoning.
