# Implementation Plan — Ticket 002

**Author (role):** Bug Planner
**Inputs:**
- `context/bugs/002/research/codebase-research.md`
- `context/bugs/002/research/verified-research.md` (produced by the pipeline's Bug Research
  Verifier stage — treat as authoritative if it corrects anything below)

**Test command:** `npm test` (run from the `homework-4/` directory)

Apply the change below. Run `npm test` after applying it.

---

## Change 1 — Validate `addExpense` input (BUG-003)

**File:** `src/services/expenseService.js`
**Location:** line 4 (start of `addExpense`)

**Before:**
```js
function addExpense({ description, amount, category }) {
  const expense = {
    id: nextId++,
    description,
    amount,
    category,
  };
  expenses.push(expense);
  return expense;
}
```

**After:**
```js
function addExpense({ description, amount, category }) {
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error('description must be a non-empty string');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error('amount must be a finite number');
  }
  if (typeof category !== 'string' || category.trim() === '') {
    throw new Error('category must be a non-empty string');
  }
  const expense = {
    id: nextId++,
    description,
    amount,
    category,
  };
  expenses.push(expense);
  return expense;
}
```

**Rationale:** Rejects invalid input at the single point of entry, before it ever reaches the
shared `expenses` array or `getSummary`'s reduce. `src/server.js`'s existing top-level
`try/catch` around the request handler already converts a thrown error into an HTTP `400`
with the error message (see `src/server.js`, unchanged by this ticket) — no change needed
there.

**Expected test effect:** No existing test exercises invalid input, so no regression is
expected. (The Unit Test Generator stage, run later on this changed file, is expected to add
coverage here.)

---

## Manual Verification (for the human reviewer, after the pipeline completes)

1. `npm start` (starts the API on port 3000).
2. `curl -X POST localhost:3000/expenses -H 'Content-Type: application/json' -d '{"description":"Coffee","amount":"abc","category":"food"}'`
   — should be rejected with a `400` and an `amount must be a finite number` error, not
   stored.
3. `curl localhost:3000/expenses/summary` — `total`/`average` should stay numeric and correct,
   unaffected by the rejected request above.

---

## References

- `context/bugs/002/research/codebase-research.md`
- `src/services/expenseService.js`
