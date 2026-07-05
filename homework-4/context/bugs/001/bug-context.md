# Bug Context — Ticket 001

## Reported Symptoms

Three issues were reported against the Expense Tracker API (`src/`) during manual QA of the
`v1.0.0` build:

1. **Wrong summary numbers.** `GET /expenses/summary` returns an `average` that does not match
   `total / count` for any test data set. QA also saw a negative-looking average (`-0`) on an
   empty account.
2. **Category filter returns everything.** `GET /expenses?category=food` returns *all* expenses
   regardless of category, and after calling it once, previously-"transport" expenses show up
   as `"food"` on subsequent unfiltered `GET /expenses` calls — the data itself appears to change.
3. **Export endpoint flagged by a teammate during code review.** `GET /expenses/export` shells
   out to copy a file using a filename taken directly from the request; a teammate asked whether
   that's safe before we ship the endpoint externally.

## Scope for This Investigation

Find the root cause of (1) and (2) in `src/services/expenseService.js`, and confirm/describe the
concern raised in (3) around `src/utils/exportUtil.js` so it can be routed to security review.

## Inputs

- Application source: `src/`
- Test suite: `tests/expenseService.test.js` (`npm test`) — currently 3 of 4 subtests fail,
  consistent with symptoms (1) and (2).

## Next Step

Bug Researcher to investigate and produce `research/codebase-research.md` with file:line
references and code snippets for each finding.
