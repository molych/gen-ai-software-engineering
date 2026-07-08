# Codebase Research — Ticket 002

**Author (role):** Bug Researcher
**Input:** `context/bugs/002/bug-context.md`
**Scope:** `src/services/expenseService.js`, `src/server.js`

---

## Finding BUG-003: No input validation in `addExpense`

- **File:** `src/services/expenseService.js`
- **Line:** 4-13
- **Claimed snippet:**
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
- **Description:** `addExpense` stores whatever `description`/`amount`/`category` it's given
  with no type or shape checks. `getSummary` (line 33) reduces over `expenses` with
  `sum + expense.amount`; if any stored `amount` is not a number, JavaScript's `+` operator
  falls back to string concatenation (or produces `NaN`), so `total` becomes a corrupted
  string/NaN for *every* subsequent call to `getSummary` — not just the one bad request —
  because `expenses` is shared, persistent, in-memory module state.
- **Suggested root cause:** add a validation guard at the top of `addExpense` that rejects
  non-numeric `amount` and non-string `description`/`category`.

## Additional Observations (not fully investigated — flagging only)

- `src/server.js`'s `POST /expenses` handler has no validation of its own either; it passes
  the parsed JSON body straight to `addExpense` unchecked. The top-level `try/catch` around
  the request handler already converts a thrown error into a `400` response with the error
  message, so a validation fix inside `addExpense` alone should be sufficient — no change to
  `server.js` appears necessary, but confirm this during planning.

---

## References

- `context/bugs/002/bug-context.md`
- `context/bugs/001/security-report.md` (LOW-1 — origin of this ticket)
- `src/services/expenseService.js`
- `src/server.js`
- `tests/expenseService.test.js` (no test currently covers invalid input)
