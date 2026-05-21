---
name: cmp-framework
description: Apply the Context-Model-Prompt framework when generating code, tests, or docs for the customer-support homework. Use before any AI-assisted generation task in homework-2.
---

# Context-Model-Prompt framework

Homework 2 is explicitly graded on applying **Context-Model-Prompt (CMP)**. Use this
skill whenever you generate code, tests, or documentation so the workflow is
consistent and documentable.

## The three steps

### 1. Context — assemble before prompting
Pull together what the task actually needs, no more:
- The ticket schema, enums, and classification rules from `homework-2/CLAUDE.md`.
- The relevant existing files (the module being changed and its current tests).
- The acceptance bar: which `TASKS.md` task this serves and its done criteria.
State the context explicitly rather than assuming it carries over.

### 2. Model — pick deliberately
- **Opus** — architecture, design trade-offs, `ARCHITECTURE.md`, hard classification logic.
- **Sonnet** — routine endpoint/parser implementation, test authoring.
- **Haiku** — boilerplate, fixture data, mechanical doc sections.
Record which model was used for which artifact — Task 4 requires different models
for different doc types, and the AI-usage write-up needs this.

### 3. Prompt — structure every request
Order: **Context → Task → Constraints → Examples → Output format.**
- Constraints must name: validation against the closed enums, correct HTTP codes,
  graceful malformed-input handling, and the >85% coverage gate.
- Ask for one cohesive unit at a time; iterate rather than expecting one-shot output.

## After generating
- Read the output — do not paste blind. Verify it against the Context's done criteria.
- Capture the prompt and which model produced it for `docs/screenshots/` and the PR.
