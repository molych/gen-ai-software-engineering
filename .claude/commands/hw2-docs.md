---
description: Generate or refresh the four Homework 2 documentation files
---

Generate the four Homework 2 documentation files (`TASKS.md` Task 4), each for a
distinct audience. Apply the `cmp-framework` skill and use a model suited to each
doc — delegate to the `doc-writer` subagent with a per-doc model override.

| File | Audience | Model | Must include |
|------|----------|-------|--------------|
| `README.md` | Developers | Sonnet | Overview, features, setup, how to run tests, project structure, **architecture Mermaid diagram** |
| `API_REFERENCE.md` | API consumers | Haiku | Every endpoint with request/response examples, data models, error formats, cURL examples |
| `ARCHITECTURE.md` | Tech leads | Opus | High-level **Mermaid diagram**, components, **Mermaid sequence diagram** for data flow, design trade-offs, security/performance notes |
| `TESTING_GUIDE.md` | QA engineers | Sonnet | **Test-pyramid Mermaid diagram**, how to run tests, fixture locations, manual checklist, performance benchmarks table |

Requirements:
- **At least 3 Mermaid diagrams total** across the documents.
- Documentation must match the actual implemented behavior — read the source first.
- Record which model wrote which doc; the PR write-up needs this.
