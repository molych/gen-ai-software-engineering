Generate or update `specification.md` for this project using the required template.

Steps:
1. Read `TASKS.md` and `agents.md` in this directory, and `sample-transactions.json`, for context on the pipeline's requirements and domain rules.
2. Produce `specification.md` with exactly these top-level sections, in this order:
   - `## High-Level Objective`
   - `## Mid-Level Objectives`
   - `## Implementation Notes`
   - `## Context` with `### Beginning context` and `### Ending context` subsections
   - `## Low-Level Tasks`
3. High-Level Objective: one sentence describing what the pipeline does end to end.
4. Mid-Level Objectives: 4-5 concrete, independently testable bullets (e.g. thresholds, file outputs, logging guarantees, coverage targets) — derive these from the pipeline stages that exist (or are planned) in this project, not generic placeholders.
5. Implementation Notes: monetary values as `decimal.Decimal` (never `float`), ISO 4217 currency validation, ISO-8601 audit logging with stage/transaction/outcome, and PII-safe logging (no raw account numbers or free-text descriptions).
6. Context: Beginning context = what exists today (e.g. `sample-transactions.json`, any pipeline code already present); Ending context = the files/state that should exist when the pipeline is complete (pipeline modules, `shared/results/`, tests, front-end, MCP server).
7. Under Low-Level Tasks, create one numbered subsection per pipeline stage. Each subsection must answer, in this literal order:
   - "What prompt would you run to complete this task?"
   - "What file do you want to CREATE or UPDATE?"
   - "What function do you want to CREATE or UPDATE?"
   - "What are details you want to add to drive the code changes?"
8. If `specification.md` already exists, update it in place to stay consistent with the current codebase rather than duplicating sections.
9. Do not write or modify any code files — this command only produces/updates `specification.md`.
