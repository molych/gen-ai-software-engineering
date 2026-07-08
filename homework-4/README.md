# Homework 4 — 4-Agent Bug-Fix Pipeline

This directory contains a 4-agent pipeline (Bug Research Verifier, Bug Fixer, Security
Vulnerabilities Verifier, Unit Test Generator) and a small sample application the pipeline
operates on. See `TASKS.md` for the original assignment and `HOWTORUN.md` for a step-by-step
walkthrough of both.

> **Student Name**: Oleksandr Mochalov
> **Date Submitted**: 8 Jul 2026
> **AI Tools Used**: Claude Code

---

## Running the Pipeline

```bash
npm run pipeline      # ticket 001 (default) — see HOWTORUN.md for details
```

One command starts all 4 required agents — Bug Research Verifier, Bug Fixer, Security
Verifier, Unit Test Generator — as non-interactive `claude -p` sessions, strictly in that
order, with no manual step in between:

```
Bug Research Verifier → Bug Fixer → Security Verifier → Unit Test Generator
```

Each stage reads its model and its allowed tools straight from that agent's own frontmatter
in `agents/*.agent.md`, and reads whichever skill file its "Required Reading" section names
itself (via the `Read` tool) — nothing is injected by the runner beyond the agent's own
instructions. The pipeline stops immediately if a stage doesn't produce its expected output
file, or if `npm test` fails after the Bug Fixer stage. See `run-pipeline.sh` and
`HOWTORUN.md` for the mechanics, and `./run-pipeline.sh --dry-run 001` for a no-cost preview
of exactly what each stage will run.

## Agents & Model Choices

| Agent | Model | Why |
|---|---|---|
| `research-verifier.agent.md` | `claude-opus-4-8` | Its entire value is catching subtle discrepancies (an off-by-one line, a snippet quoting `==` when the source has `=`) that a faster model tends to skim past — a wrong PASS here propagates silently downstream. |
| `bug-fixer.agent.md` | `claude-sonnet-5` | By this stage all ambiguity is resolved upstream — the plan gives an exact file, location, and before/after code. The job is precise, low-creativity execution, a good fit for a cheaper model than the reasoning-heavy verifier stages. |
| `security-verifier.agent.md` | `claude-opus-4-8` | The findings that matter are the ones a quick pattern-match misses (an allow-list that still lets `..` through, a race condition, a validation gap two functions away) — this needs the same top-tier reasoning as the research verifier, not the cheaper model used for mechanical stages. |
| `unit-test-generator.agent.md` | `claude-haiku-4-5-20251001` | Writing FIRST-compliant tests for an already-fixed, already-scoped function is scaffolding, and the agent self-validates by actually running `npm test` — low ambiguity plus a built-in correctness check is exactly where the cheapest tier is sufficient. |

(Full reasoning for each is in that agent's own `model_justification` frontmatter field.)

## Screenshots

Pipeline run, applied fixes, security scan, and unit test run are captured in
`docs/screenshots/`.

---

## Sample Application — Expense Tracker API

A minimal, dependency-free Node.js HTTP API for tracking expenses. It exists to give the
4-agent pipeline something concrete to research, fix, security-review, and test.

**Stack:** Node.js only — no npm dependencies, no framework. Uses the built-in `http` module
and the built-in `node:test` test runner.

### Requirements

- Node.js 18+ (developed and verified on v20.18.3). No `npm install` needed — the app has zero
  runtime dependencies.

### Run

```bash
npm start
# Expense Tracker API listening on port 3000
```

### Test

```bash
npm test
# runs tests/ via the Node built-in test runner (node --test tests/)
```

### API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/expenses` | Create an expense. Body: `{ "description": string, "amount": number, "category": string }` |
| `GET` | `/expenses` | List all expenses, or filter with `?category=<name>` |
| `GET` | `/expenses/summary` | Returns `{ total, count, average }` across all expenses |
| `GET` | `/expenses/export?filename=<name>` | Copies a CSV export into `exports/<name>` (filename is validated) |
| `DELETE` | `/expenses` | Clears all expenses. Requires header `x-api-key: sk-demo-admin-key-12345` |

Example:

```bash
curl -X POST localhost:3000/expenses \
  -H 'Content-Type: application/json' \
  -d '{"description":"Coffee","amount":4,"category":"food"}'

curl localhost:3000/expenses/summary
curl 'localhost:3000/expenses?category=food'
curl 'localhost:3000/expenses/export?filename=out.csv'
```

### Project Structure

```
homework-4/
├── src/
│   ├── server.js                  # HTTP entry point (npm start)
│   ├── services/expenseService.js # in-memory expense store + business logic
│   ├── utils/exportUtil.js        # CSV export to disk
│   └── middleware/auth.js         # admin API-key check
├── tests/
│   ├── expenseService.test.js
│   └── exportUtil.test.js
├── run-pipeline.sh    # single-command pipeline runner (npm run pipeline)
├── HOWTORUN.md         # step-by-step run instructions (app + pipeline)
├── agents/             # the 4 required pipeline agents (*.agent.md)
├── skills/             # research-quality-measurement.md, unit-tests-FIRST.md
├── docs/screenshots/   # pipeline run, fixes, security scan, unit tests
└── context/bugs/001/   # this ticket's research, plan, and reports
```

### Seeded Bugs & Security Issue (Ticket 001)

The app originally shipped with 2 intentional bugs and 1 intentional security vulnerability,
seeded for the pipeline to find and fix. All three have now been fixed and are covered by
tests; the full trail (research → verification → plan → fix → security review → generated
tests) is in `context/bugs/001/`.

| ID | Issue | Location | Status |
|---|---|---|---|
| BUG-001 | `getSummary` divided by `count - 1` instead of `count` (also produced `-0` on an empty account) | `src/services/expenseService.js` | ✅ Fixed |
| BUG-002 | `getExpensesByCategory` used assignment (`=`) instead of comparison (`===`), so filtering matched everything and mutated stored data | `src/services/expenseService.js` | ✅ Fixed |
| SEC-001 | `exportExpensesToFile` built a shell command from an unsanitized filename via `child_process.exec` (OS command injection) | `src/utils/exportUtil.js` | ✅ Fixed |

Pipeline artifacts for this ticket, in order:

1. `context/bugs/001/bug-context.md` — reported symptoms (the pipeline's starting point)
2. `context/bugs/001/research/codebase-research.md` — Bug Researcher's findings
3. `context/bugs/001/research/verified-research.md` — Bug Research Verifier's fact-check (per
   `skills/research-quality-measurement.md`)
4. `context/bugs/001/implementation-plan.md` — Bug Planner's exact before/after plan
5. `context/bugs/001/fix-summary.md` — Bug Fixer's record of changes and test results
6. `context/bugs/001/security-report.md` — Security Verifier's findings on the changed code
7. `context/bugs/001/test-report.md` — Unit Test Generator's new coverage (per
   `skills/unit-tests-FIRST.md`)

Current state: `npm test` passes (30/30), and manual verification of all three fixes against
the running server (`npm start`) is documented in `fix-summary.md`.
