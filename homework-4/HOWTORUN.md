# How to Run

Two separate things live in this repo: the **sample application** (Task 5) and the
**4-agent pipeline** that researches, fixes, security-reviews, and tests bugs in it (Tasks 1-4).

## 1. Run the sample application

```bash
npm start
# Expense Tracker API listening on port 3000
```

No `npm install` is needed — zero runtime dependencies.

```bash
npm test
# node --test tests/  ->  30 pass, 0 fail
```

See `README.md` for the full API reference and example `curl` commands.

## 2. Run the 4-agent pipeline

```bash
npm run pipeline           # ticket 001 (default)
npm run pipeline -- 001    # same, explicit
./run-pipeline.sh 001      # equivalent, direct
```

This is **one command**. It starts the 4 required agents — Bug Research Verifier, Bug
Fixer, Security Verifier, Unit Test Generator — as separate non-interactive `claude -p`
sessions, strictly in that order, with no manual step in between. Each stage:

- Uses the **model declared in that agent's own frontmatter** (`agents/*.agent.md`,
  e.g. `claude-opus-4-8` for the two reasoning-heavy verifier stages, `claude-sonnet-5`
  for the mechanical fix stage, `claude-haiku-4-5-20251001` for test scaffolding).
- Is restricted to **exactly the tools that agent's frontmatter grants** (e.g. the
  Security Verifier has no `Edit` tool at all — it technically cannot modify `src/`,
  not just by instruction but by tool availability).
- Reads whatever skill file its own "Required Reading" section names
  (`skills/research-quality-measurement.md`, `skills/unit-tests-FIRST.md`) itself, via
  the `Read` tool — the runner doesn't need to inject skill content separately.
- Stops the whole pipeline immediately if its expected output file isn't produced, or
  if `npm test` fails after the Bug Fixer stage (mirroring that agent's own "stop on
  unexpected failure" rule).

Per-stage transcripts are written to `context/bugs/<ticket>/pipeline-logs/` and also
streamed to the terminal as they run.

### Prerequisites for a ticket

`run-pipeline.sh` automates the 4 *required* agents only — it does not automate "Bug
Researcher" or "Bug Planner" (neither is one of the 4 required pipeline agents; see the
flowchart in `TASKS.md`). Before running the pipeline for ticket `<id>`, these three
files must already exist:

- `context/bugs/<id>/bug-context.md`
- `context/bugs/<id>/research/codebase-research.md`
- `context/bugs/<id>/implementation-plan.md`

For ticket `001` they already exist in this repo, so `npm run pipeline` runs start to
finish with no setup.

### Dry run

```bash
./run-pipeline.sh --dry-run 001
```

Prints the exact `claude` invocation (model, tools, prompt, expected output file) for
every stage without starting any session or touching any file. Useful for sanity
checking the script itself, or for a lower-cost look at what the pipeline will do before
spending real API time on a full run.

### A note on `--permission-mode bypassPermissions`

The runner passes `--permission-mode bypassPermissions` to each `claude` invocation —
required for a non-interactive session to actually apply edits / run Bash without a
human present to approve each tool call. The `--tools` restriction per stage (above) is
the safety boundary in place of interactive approval: a stage simply has no access to
tools outside what its own `*.agent.md` frontmatter declares.
