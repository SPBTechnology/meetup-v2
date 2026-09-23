# Context directory

The maintained, tool-neutral description of this project. It exists so that any person or
AI assistant can rebuild working context quickly, including after a change of tooling.
If this directory and the code disagree, the code wins — fix this directory in the same change.

## Reading order

| # | File | Read when | What it answers |
|---|------|-----------|-----------------|
| 1 | [state.md](state.md) | Always, first | What phase are we in, what's done, what's next, known issues |
| 2 | [product.md](product.md) | Starting any feature | Who it's for, MVP scope, explicit non-goals |
| 3 | [architecture.md](architecture.md) | Touching more than one layer | How the pieces fit and why |
| 4 | [data-model.md](data-model.md) | Any schema / RLS / data-layer work | Tables, relationships, access rules |
| 5 | [conventions.md](conventions.md) | Writing code | Patterns to follow, known library gotchas |
| 6 | [testing.md](testing.md) | Writing tests (i.e. always) | Which layer tests what, how to write each |
| 7 | [runbook.md](runbook.md) | Running things locally | Commands, ports, device setup, troubleshooting |
| 8 | [decisions/](decisions/) | Questioning "why is it like this?" | ADRs — append-only decision log |

## How this directory is maintained

- **Don't document what the code already says.** No file inventories, no column-by-column
  copies of migrations. Record *why*, *rules*, and *intent*; point to code for *what*.
- **Decisions are append-only.** Changing a decision = new ADR marked `Supersedes: NNNN`,
  and the old ADR's status updated to `Superseded by NNNN`. Nothing else in it is edited.
- **`state.md` is the only frequently-changing file.** Update it at the end of every task,
  with the date. Keep it short enough to read in under a minute.
- Other files change when the thing they describe changes, in the same commit.

Archived material from the prototype (`meetup/`) lives in [../archive/](../archive/) for
reference only — it describes a different codebase.
