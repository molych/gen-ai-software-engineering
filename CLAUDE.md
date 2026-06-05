# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is a **homework submission repository** for the "GenAI and Agentic AI for Software Engineering" training course. It is not a single application — it is a container of independent, self-contained assignments under `homework-N/`. No implementation code is committed yet; the `src/` directories hold only `.gitkeep` placeholders.

There is therefore **no repo-wide build, lint, or test command**. Each assignment chooses its own technology stack (Node.js, Python, or Java are the suggested options), and the relevant commands only exist once that homework is implemented. When implementing a homework, also author its `HOWTORUN.md` with the concrete run/test commands.

## Structure and how to work within it

Each `homework-N/` folder is the unit of work and must stay self-contained:

- `TASKS.md` — the **assignment spec given by the instructor**. Treat it as read-only requirements; do not edit it. This is the source of truth for what to build.
- `README.md` — student-facing writeup: solution overview, approach, AI tools used, author. Currently a template to be filled in.
- `HOWTORUN.md` — step-by-step run/setup/testing instructions (HW1/HW2 only; currently a stub).
- `src/` — implementation code goes here.
- `docs/screenshots/` — required visual evidence (AI interactions, app running, test results).
- `demo/` — runnable demo scripts (`run.sh`/`run.bat`) and sample requests/data (HW1/HW2).

Do not add cross-homework shared code, root-level dependency manifests, or tooling that spans folders — keep each homework's dependencies and config inside its own folder.

### Current assignments

- **homework-1** — Banking Transactions API: in-memory REST API for transactions with validation, filtering, and one extra feature. Code-based.
- **homework-2** — Customer Support ticket system: multi-format (CSV/JSON/XML) import, auto-classification, and an AI-generated test suite targeting **>85% coverage**. Code-based.
- **homework-3** — Specification-driven design: **documents only, no code**. Deliverables are `specification.md`, `agents.md`, editor/AI rules, and `README.md`. `specification-TEMPLATE-example.md` is the starting shape. Do not create `src/` here.

## Submission workflow

This affects how changes should be committed. Per the root `README.md`:

- Each assignment is developed on its own branch named `homework-N-submission` and submitted as a Pull Request — not committed directly to `main`.
- PRs must have a **detailed description** (what was implemented, how AI was used, how to verify) and **embedded screenshots**. Bare or undocumented PRs are rejected, so screenshots in `docs/screenshots/` and a filled-in `README.md`/`HOWTORUN.md` are part of "done", not optional extras.
