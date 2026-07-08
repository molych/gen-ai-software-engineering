# Bug Context — Ticket 002

## Reported Symptoms

Flagged by the Security Verifier during the ticket-001 review
(`context/bugs/001/security-report.md`, finding **LOW-1**):

1. **Unvalidated `amount` corrupts the summary endpoint.** `POST /expenses` accepts any value
   for `description`/`amount`/`category` with no type checking. A single request with a
   non-numeric `amount` (a string, `null`, or an object) poisons `GET /expenses/summary` for
   *every subsequent caller* until the process restarts or `reset()` is called — `total`
   becomes a corrupted concatenated string and `average` serializes to JSON `null`.

## Scope for This Investigation

Find the root cause in `src/services/expenseService.js` (`addExpense`) and its effect on
`getSummary`, and determine the minimal fix that rejects invalid input at the point of entry.

## Inputs

- Application source: `src/`
- Prior finding: `context/bugs/001/security-report.md` (LOW-1)
- Test suite: `tests/expenseService.test.js` (`npm test`) — currently all passing; no test
  exercises invalid `amount`/`description`/`category` input.

## Next Step

Bug Researcher to investigate and produce `research/codebase-research.md` with file:line
references and code snippets for the finding.
