---
description: Finish ticket with bounded implementation, verification, and evidence
agent: build
---

# Finish Task

Finish ticket at `$ARGUMENTS`. Input must be one ticket path. Default maximum is
five repair rounds.

## Rules

- Read ticket, root and scoped `AGENTS.md`, product contract, and relevant docs.
- Inspect branch, `git rev-parse HEAD`, and `git status --porcelain` first.
- Record dirty and untracked baseline. Preserve baseline files and changes.
- Do not resolve product or policy conflicts. Stop `DECISION_REQUIRED`.
- Agent fixes ordinary technical failures, then repeats verification.
- Do not weaken, skip, mirror, or rewrite tests to fit implementation.
- API, render, external-cost operation, migration, deployment, destructive action,
  stage, commit, and push require ticket permission.

## Loop

1. Validate ticket path and required ticket fields.
2. Inspect repository, callers, dependencies, docs, and existing tests.
3. Reproduce current behavior when possible.
4. Implement smallest change within ticket scope.
5. Run relevant verification. Available ECC/OpenCode commands found in this repo:
   `/verify`, `/quality-gate`, `/code-review`.
6. Diagnose and repair technical failure. Repeat from step 5, maximum five rounds.
7. Audit final diff, allowlist, secrets, test claims, and baseline preservation.

Stop with `BLOCKED` after five unsuccessful rounds or unresolved technical,
environment, dependency, or invariant blocker. Do not report blocked evidence as
`PASS`.

## Required Evidence

Report exact commands actually run, each result, changed files, baseline
preservation, and open decisions or authority needs. Never claim a gate ran when
it did not.

```text
Status: DONE | DECISION_REQUIRED | AUTHORITY_REQUIRED | BLOCKED
Ticket: <path>
Baseline: <branch>, <HEAD>, <status summary>
Rounds: <n>/5
Commands run: <exact commands>
Verification: <result and evidence>
Changed files: <paths>
Pre-existing changes preserved: yes/no
Open decisions or authority needed: <none or list>
```
