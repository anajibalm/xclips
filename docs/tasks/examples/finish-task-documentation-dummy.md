# Documentation Dummy Ticket

ID: XCLIPS-GOV-DUMMY-DOC
Title: Verify local finish-task governance command
Parent epic: Agent governance

## Problem

Governance command needs one documentation-only ticket for a bounded validation
example.

## Observable current behavior

No ticket demonstrates documentation-only execution and evidence reporting.

## Expected outcome

Validate governance documentation without changing source code, tests, package
files, settings, artifacts, or global OpenCode configuration.

## Product invariants

- Product and policy conflicts remain `DECISION_REQUIRED`.
- `BLOCKED` evidence never becomes `PASS`.
- Existing dirty and untracked work remains unchanged.

## Out of scope

- Source code, tests, package files, settings, and artifacts.
- API, render, migration, deployment, push, or merge.
- Global command installation.

## Observable PASS

- Ticket and governance docs pass `git diff --check`.
- Secret scan has no actual secret; governance terms such as `token` are
  classified, not deleted.
- Only intended documentation files change.
- Evidence report includes exact commands and final stop state.

## Forbidden shortcuts

- Do not use `git add .` or `git add -A`.
- Do not claim tests or gates ran without running them.
- Do not alter expected behavior to make validation pass.

## Permission boundary

Agent may inspect files and run documentation validation. Stage and one local
governance commit are permitted by parent task. Push, merge, global installation,
API, render, and external-cost operations remain forbidden.

## Dependencies

- `AGENTS.md`
- `docs/product/xclips-production-contract.md`
- `.opencode/commands/finish-task.md`

## Required evidence

- Worktree path, branch, HEAD, and initial/final status.
- Exact validation commands and results.
- Changed-file allowlist and baseline preservation.

## Valid stop states

- `DONE`: documentation validation passes.
- `DECISION_REQUIRED`: product or policy conflict appears.
- `AUTHORITY_REQUIRED`: requested operation exceeds ticket permission.
- `BLOCKED`: technical or invariant blocker remains after repair.
