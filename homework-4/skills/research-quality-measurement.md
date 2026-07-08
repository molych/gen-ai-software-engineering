# Skill: Research Quality Measurement

**Used by:** `agents/research-verifier.agent.md` (and any future agent that must rate the
reliability of a research/investigation document before someone acts on it).

**Purpose:** Turn "verify every claim" into a reproducible score, so two different verifier runs
over the same research document reach the same quality label. Every level below must be assigned
from measured axes, not from a gut feeling about "how good the research seemed."

---

## 1. The Two Measured Axes

For every discrete claim in the research document that names a file and points at code
(a "reference"), score it on two axes:

### Reference Accuracy
Does the cited `file:line` actually contain the code the claim is about?

- **Exact** — the cited line(s) contain the described code.
- **Near-miss** — the described code exists in the cited file, within **±3 lines** of the
  citation (off-by-one/off-by-a-few from re-counting or an edit after research).
- **Wrong** — the described code is not near the citation, is in a different file than claimed,
  or does not exist at all.

### Snippet Fidelity
Where the document quotes a code snippet verbatim, does it match the source at that location?

- **Exact** — matches modulo whitespace/formatting.
- **Paraphrased** — same operator/logic/shape but not a literal match (e.g. renamed variable).
- **Mismatched** — the quoted snippet shows different logic than the source (e.g. a different
  operator, a different condition) — this is the most serious snippet failure, because a reader
  who trusts the snippet over the source will misdiagnose the bug.

Every reference is also tagged **Material** or **Cosmetic** for how a Wrong/Mismatched result
would affect a reader:
- **Cosmetic** — the reader would still find the right code and reach the right root cause (e.g.
  line number off by 1, quoted snippet differs only in a renamed variable).
- **Material** — acting on the claim as written would misdiagnose the bug, point the fix at the
  wrong mechanism, understate severity, or send a reader to the wrong file/request path entirely.

---

## 2. Aggregate Metrics

Compute, across all references in the document:

```
Reference Accuracy %  = (Exact + Near-miss) / Total references
Snippet Fidelity %    = (Exact + Paraphrased) / Total snippets quoted
Material Defect Count = number of references/snippets marked Material AND (Wrong or Mismatched)
```

---

## 3. Quality Levels

Pick the **lowest** level satisfied by all three conditions (Material Defect Count is a hard
gate — one material defect caps the level at FAIR regardless of the percentages).

| Level | Reference Accuracy | Snippet Fidelity | Material Defect Count | Meaning |
|---|---|---|---|---|
| **EXCELLENT** | 100% | 100% | 0 | Every citation and snippet checks out exactly. Safe to act on with no re-verification. |
| **GOOD** | ≥ 90% | ≥ 90% | 0 | Minor cosmetic slips only (e.g. a line off by one, a renamed variable in a snippet). Safe to act on; correct the cosmetic slips in passing. |
| **FAIR** | ≥ 70% | ≥ 70% | ≤ 1 | Usable, but at least one finding needs a second look before anyone acts on it — either the accuracy dipped meaningfully or one material defect was found. Call out exactly which finding(s) need re-verification. |
| **POOR** | < 70% (either axis) | — | ≥ 2 | Not reliable as-is. More than one material defect, or citations are wrong often enough that spot-checking isn't enough — the whole document needs another research pass. |
| **UNRELIABLE** | — | — | — | Any reference is to a file that does not exist, or the majority of citations are Wrong. Reject outright; do not forward downstream. |

---

## 4. Pass/Fail Gate

Translate the level into the pass/fail line required in a verification result's
**Verification Summary**:

- **PASS** — level is EXCELLENT or GOOD.
- **PASS WITH CAUTION** — level is FAIR. State exactly which finding(s) carry the defect so the
  next consumer (e.g. Bug Planner) knows what to double-check before relying on it.
- **FAIL** — level is POOR or UNRELIABLE. The research document should be sent back for another
  research pass before anyone plans a fix from it.

---

## 5. How to Apply This Skill

1. List every finding in the research document as a row.
2. For each finding, open the cited file at the cited line and compare against the claim and any
   quoted snippet. Classify Reference Accuracy and Snippet Fidelity per the definitions above, and
   tag Material/Cosmetic for any discrepancy.
3. Compute the aggregate metrics (Section 2).
4. Select the quality level using the table in Section 3 (remember: Material Defect Count is a
   hard gate, not just an input to a percentage).
5. Record the level, the metrics that produced it, and the pass/fail line in the result document's
   **Research Quality Assessment** section, with reasoning that names the specific findings that
   drove the score (not just the label).
