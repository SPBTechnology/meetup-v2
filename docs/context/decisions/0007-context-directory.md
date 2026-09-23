# 0007 — Maintained, tool-neutral context directory

- **Status:** Accepted · 2026-09-23

## Context
The prototype's AI context docs described intended rather than actual behaviour (e.g. the auth
switch was never recorded), and context was tied to whichever AI tool was in use.

## Decision
`AGENTS.md` is the single entry point (CLAUDE.md and Copilot instructions only point to it).
`docs/context/` holds state, product, architecture, data model, conventions, testing, runbook
and ADRs. Updating it is part of the definition of done. Don't duplicate what code says;
ADRs are append-only; `state.md` updated every task.

## Consequences
+ Context survives tool changes and lost sessions; drift is caught in review.
− Small per-task overhead. A CI check (migrations/deps changed ⇒ docs/context changed) is planned with CI in Phase 1.
