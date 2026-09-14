# xClips Evidence Ledger (Canonical)

Status: LEDGER (reconciliation record, not a slice-closure claim)
Branch: `feat/auto-production-mvp`
HEAD at ledger time: `3cf5750` (`docs(xclips): add finish-task governance command`)
Ledger date: 2026-09-14
Refined (elicitation pass): 2026-09-14 — methods: Assumption Audit,
Challenge from Critical Perspective, Pre-mortem Analysis
(`bmad-advanced-elicitation`). The pass changed conflict framing, not
evidence: objective repository facts are stated outright; only genuine
product-policy choices remain open.
Authoritative invariants: `docs/product/xclips-production-contract.md`,
`docs/architecture/auto-production-mvp11.md`, slice contracts in
`config/auto-production/slice-contracts/`, `AGENTS.md` slice/governance rules.

## Method

- Every claim below was checked against the current worktree, committed
  history, or a verification run executed for this ledger. Prior agent
  reports (including `docs/todos.md` workboard claims) are treated as
  leads, never as proof, unless independently confirmed here.
- Unit/type verification is recorded separately from runtime, render, API,
  and end-to-end verification. A green unit test never implies a render,
  a production run, or human acceptance.
- `artifacts/` is untracked workspace evidence. File existence alone never
  closes a slice (binding rule R0.1 in `docs/todos.md`, upheld here).
- Four-way separation (elicitation pass): every conflict below is split
  into (1) system-capability status, (2) specific run/artifact status,
  (3)   documentation status, and (4) product-policy decisions. Layers 1–3
  are settled from repository evidence by the agent; layer 4 alone may
  need the owner. The owner is never asked to choose an objective fact.
  Split rows (e.g. E9/E9b/E9c, E10/E10b) jointly describe one capability:
  a capability-level status never denies its run-level evidence, and a
  run-level status never upgrades the capability beyond what the runs show.

## Product decision D1 (owner, 2026-09-14)

Affirmed: **fail-closed-until-whisper-proven** is the production posture.

The trusted-alignment success path may be proven by **one authorized,
post-`f0422b4` anchored run using a real source**, provided it produces
durable evidence for valid opening and ending physical anchors, preserves
all locked thresholds and ordering invariants, successfully mints trusted
authority, and reaches `production_valid` without bypass or manual
fabrication.

Scope limits (owner-stated, upheld here): this proves the
**trust-alignment capability only**. It does not prove product or release
readiness. **S6 FINAL remains the separate end-to-end product acceptance
gate.** T1 documentation reconciliation completed against this decision;
see CF1 and T1.

## Status vocabulary (only these)

- `DONE_AND_VERIFIED` — acceptance met AND confirmed by durable evidence
  (test, gate output, history, or recorded human attestation).
- `IMPLEMENTED_NOT_RUNTIME_VERIFIED` — code/artifact exists and is
  unit- or type-verified, but no runtime/render/API/E2E run confirms it
  in this ledger.
- `NOT_IMPLEMENTED` — no worktree evidence of the capability.
- `DECISION_REQUIRED` — a human product/policy answer is needed first.
- `STALE_OR_CONFLICTING_EVIDENCE` — sources disagree; see Conflicts.

## Verification-level vocabulary

`UNIT` (bun test) · `TYPE` (`tsc --noEmit`) · `HISTORY` (git objects) ·
`FILE` (worktree read) · `DIFF` (uncommitted-change inspection) ·
`RUNTIME` (executed pipeline/render/API/E2E) · `HUMAN` (recorded
human attestation — none found in repo for any slice).

## Claim ledger

### Slices

| ID | Capability / behavior | Status | Evidence source | Verification | Last verified | Contradiction / uncertainty | Next action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E1 | S1 — one correct editorial clip | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Commit `8ba8888` (2026-09-10) exists (`git cat-file -t`); `artifacts/slice-1-correct-editorial-clip/final.mp4` (6.5 MB) + `machine-check.json` + `edit-plan.json` exist | HISTORY + FILE | 2026-09-14 | Commit linkage and artifact confirmed, but no `HUMAN` PASS record exists in repo and no gate was re-run for this ledger; "CLOSED" rests on the workboard report | Attach human-attestation record or re-run machine gate before citing S1 as DONE |
| E2 | S2 — one properly edited clip | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Commit `db3932d` (2026-09-10) exists; tracked contract `config/auto-production/slice-contracts/s2.json`; `artifacts/slice-2-proper-edit/` holds contracts, evidence JSONs, candidate MP4s | HISTORY + FILE | 2026-09-14 | Same gap as E1: no `HUMAN` record in repo; machine-check JSONs not re-validated here | Same as E1; S2 contract test exists (`tests/xclips/slice-contract.test.ts`, green 2026-09-14) |
| E3 | S3 — official BAKOM reels draft, presentation accepted | IMPLEMENTED_NOT_RUNTIME_VERIFIED | `artifacts/slice-3-official-bakom-draft/official-production-wired.mp4` (8.4 MB, 2026-09-10) exists; `src/lib/xclips/official-bakom-renderer.ts` is tracked (commits `5480922`, `55a4ec9`, 2026-09-11) incl. `renderOfficialBakomSequential` | HISTORY + FILE | 2026-09-14 | Workboard says "reusable renderer uncommitted" and "functional accept, engineering open" — but the renderer file IS committed; either the workboard predates Sep-11 commits or "reusable" means something narrower (CF2). No `HUMAN` accept record in repo | Reconcile workboard wording with committed renderer; record human accept explicitly |
| E4 | S4 — enriched BAKOM draft on fresh iNews source | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Untracked `config/auto-production/slice-contracts/s4.json` (`status: P1_CONTRACT_ONLY`, bounds 5.0–57.7, `FIELD_FIT_BG`); `tests/xclips/s4-contract.test.ts` green 2026-09-14; `artifacts/slice-4-enriched-bakom-draft/s4-final.mp4` (18.7 MB) + `publish-review-package.json` exist; vault source MP4+SRTs present | UNIT + FILE | 2026-09-14 | Contract is frozen but explicitly not a closure claim; framing review open (contract rationale cites `framing-observation.json` WARN); S4 bundle uncommitted | Human framing + source-graphics-collision review; then contract→closure decision |
| E5 | S5 — publish-review package | STALE_OR_CONFLICTING_EVIDENCE | Capability: `buildPublishReviewPackage` path exists in service + `publish-package-builder.test.ts` (not re-run here). Run: `artifacts/s5-publish-review-package/` (2026-09-12) holds `final.mp4` (19.2 MB), `qc.json` (all checks PASS, ffprobe-measured, CFR 30/1, 1080x1920, loudness −13.97 LUFS), checksummed `package-manifest.json`, `physical-timing.json` (direct anchors, un-authoritied — see E10b), `publication.json`; `review-flags.json` = `{blockers: [], warnings: ["framing WARN", "human review required"]}`; twin `artifacts/slice-5-publish-review-package/` (2026-09-11, same 19,174,469-byte mp4, thinner manifest, differing `qc.json`) retained as historical evidence only — non-canonical, forbidden as pipeline input (decided 2026-09-14). Doc: workboard "S5 NOT STARTED (no `artifacts/slice-5*` bundle)" — true for the `slice-5*` glob, stale as an S5-progress statement | FILE | 2026-09-14 | QC PASS is artifact-local measurement, not a production-gate verdict; human warnings open | Canonicalize one directory; reconcile workboard (doc fix, T1) |
| E6 | S6 preflight — 3-source regression fixtures | IMPLEMENTED_NOT_RUNTIME_VERIFIED | `artifacts/slice-6-three-fresh-urls/s6-corrected-truth.json` + `source-01/02/03/` + `s6a-*` run dirs and `.run.log` files exist | FILE | 2026-09-14 | Workboard's 1/3-partial score (src-01 partial / src-02 fail / src-03 pass) was NOT re-derived here; no runs executed for this ledger | Re-run or re-audit preflight evidence before citing scores |
| E7 | S6 FINAL — 3 unseen URLs, post-freeze, no coding between runs | NOT_IMPLEMENTED | No post-freeze 3-URL run bundle found; workboard concurs ("NOT RUN") | FILE | 2026-09-14 | None | Code freeze first (dirty hardening uncommitted), then run |
| E8 | S7 — one source → ~5 clips | NOT_IMPLEMENTED | No multi-clip bundle found; workboard concurs (POST-MVP) | FILE | 2026-09-14 | None | Post-MVP backlog |

### Production trust boundary

| ID | Capability / behavior | Status | Evidence source | Verification | Last verified | Contradiction / uncertainty | Next action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E9 | Trust gate wired into canonical job path (capability) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | `src/lib/xclips/auto-production-service.ts` `executeRenderCoverQc` (committed): `runPhysicalAlignment` → `finalizeProductionArtifact`, `FAILED/trust_finalization` on block (lines 522–556); `tests/xclips/production-trust.test.ts` green 2026-09-14 | UNIT (39 tests incl. trust+s4+slice-contract, 0 fail) | 2026-09-14 | No end-to-end READY observed in this ledger (Whisper/render execution forbidden for this task) | E2E trust-gate run when authorized |
| E9b | Trust-gate fail-closed execution (run status) | DONE_AND_VERIFIED | `artifacts/s6a-fresh-e2e-v6-trust/job-result.json`: stages reached `trust_finalization`, result `FAILED` with `Production trust gate blocked: missing trusted physical timing (audio alignment required)` | FILE (durable run record; run itself predates this ledger) | Run 2026-09-13, read 2026-09-14 | The block path demonstrably executes. Caveat: the run predates `f0422b4` (2026-09-14) edge-reconciliation fix, so its failure does not characterize current code | None for the block path; success path still unevidenced (see E10) |
| E9c | Whisper.cpp runtime executes locally (run status) | DONE_AND_VERIFIED | `artifacts/s6a-fresh-e2e-v6-trust/render/physical-alignment/physical-alignment.json` (36 KB, real whisper.cpp output, `language: id`, model `ggml-small-q5_1.bin`) + `.wav` (1.9 MB); runtime/model still present at `~/.cache/xclips/whisper.cpp/` | FILE | 2026-09-14 | Proves the aligner ran and produced word output; does NOT prove trusted timing (see E10 artifact rule) | None |
| E10 | Canonical producers posture (capability — objective fact, settled; policy affirmed D1) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Committed code mints trust: module-private `mintPhysicalTimeline` reachable via `runPhysicalAlignment` (Whisper.cpp, `f0422b4` 2026-09-14) and `recordCanonicalBakomRender` (`f77272a` wiring); `CANONICAL_*_AVAILABLE = true`; gate demonstrably ran (E9b). Dirty arch §6 and workboard rule 6 reconciled to this reality in T1 (were stale, pre-`f0422b4`). Owner decision D1 affirms fail-closed-until-whisper-proven and admits one authorized post-`f0422b4` anchored run as capability proof | HISTORY + FILE + DIFF + UNIT | 2026-09-14 | Success path still unevidenced: zero `production_valid` under `artifacts/`; S5 timing record carries no authority (E10b) | Authorized anchored run per D1 criteria; S6 FINAL stays the product gate |
| E10b | V6/S5 artifacts' trusted-timing standing (artifact status — objective fact, settled) | NOT_IMPLEMENTED | `s5-publish-review-package/physical-timing.json` (no authority field); `job-result.json` (E9b, blocked); S4 `baseline/physical-runtime/physical-alignment.json` (whisper timing data, un-authoritied JSON) | FILE | 2026-09-14 | Timing DATA exists (whisper outputs, bounds records); runtime-PROVEN TRUSTED TIMING exists for no artifact. Data ≠ trust, per the architecture's own §6.5.1 rule, upheld here | Authorized run through the committed gate; S6 FINAL remains the closure vehicle |
| E11 | Render-trust minting scope | IMPLEMENTED_NOT_RUNTIME_VERIFIED | `recordCanonicalBakomRender` mints `official_bakom` only for 1080x1920@30 outputs of `renderOfficialBakomSequential` (`auto-production-service.ts:218-221`); in-file comment (lines 522–527) says the current path yields no canonical render result — stale relative to lines 218–221 unless "current path" means non-default overrides | FILE | 2026-09-14 | Stale comment fixed in worktree in T1 (uncommitted one-hunk change, see T1 footprint); residual "§10" label left untouched as out of scope | Verify hunk at commit |
| E12 | Edge-anchor hardening: fragment-join (≤8) + earliest-contiguous anchor spans | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Dirty `src/lib/xclips/audio-alignment.ts` (`findContiguousPhraseSpan`, `reconcileEdgeAnchor` pinning); dirty `tests/xclips/audio-alignment.test.ts` green 2026-09-14 | UNIT (36 tests incl. alignment+deps+dispatch, 0 fail) + DIFF | 2026-09-14 | Uncommitted; S6 FINAL forbids coding between runs, so this hardening must freeze first | Freeze + commit via authorized path; no S6 FINAL before that |
| E13 | AI provider fallback (5xx → kieai retry) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Dirty `src/lib/xclips/auto-production-deps.ts` (`isRetryableProviderError`: 5xx only); untracked `tests/xclips/auto-production-deps.test.ts` green 2026-09-14 | UNIT + DIFF | 2026-09-14 | Uncommitted; 4xx (e.g. 402 balance) correctly excluded by test | Same freeze/commit path as E12 |
| E14 | Highlight JSON hardening (`parseHighlightResponse`, fenced-JSON, `maxClipsCount` clamp 1–4) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Dirty `src/lib/xclips/transcript-chunker.ts` + `src/lib/xclips.service.ts` (111+/27−, prompt + parse wiring); untracked `tests/xclips/ai-dispatch-budget.test.ts` green 2026-09-14 | UNIT + DIFF | 2026-09-14 | Uncommitted | Same freeze/commit path as E12 |

### Governance and repo health

| ID | Capability / behavior | Status | Evidence source | Verification | Last verified | Contradiction / uncertainty | Next action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E15 | Agent/product governance (contracts, ticket template, finish-task command) | DONE_AND_VERIFIED | Commits `3d1596c`, `3cf5750` present locally and on `origin/feat/auto-production-mvp` (0 ahead/0 behind); all 7 files read and present | HISTORY + FILE | 2026-09-14 | `docs/agent-workflow/finish-task-command.md` notes `finish-task` is not a global command — consistent with no `~/.config/opencode/commands/` change | None; use for T1 |
| E16 | Type health | DONE_AND_VERIFIED | `bun x tsc --noEmit`: exit 0, empty log | TYPE | 2026-09-14 | Arch debt item C (`bakom-presentation.ts` quote-type mismatch) does not reproduce at type level — either fixed or mislocated | Re-check debt item C; close or relocate it in T1 |
| E17 | Working-tree cleanliness of change surface | DONE_AND_VERIFIED | `git diff --check`: exit 0 | DIFF | 2026-09-14 | None | Keep enforcing per change |

## Conflicts (four-way split; agent settles layers 1–3, owner only layer 4)

- CF1 (E10/E10b/E11, E9b/E9c, D1): trust posture. (1) Capability: IMPLEMENTED
  and unit/type-verified — minters, wiring, and gate are committed code,
  and the gate demonstrably executes (E9b). Settled fact. (2) Run status:
  block path runtime-evidenced (v6-trust, 2026-09-13, pre-`f0422b4` code);
  success path (`production_valid`, trusted timing minted) evidenced
  NOWHERE. Settled fact. (3) Doc status: reconciled in T1 — dirty arch §6
  updated to the committed reality, stale gate comment fixed in worktree,
  this ledger records the outcome. (4) Policy: ANSWERED by owner decision
  D1 (fail-closed-until-whisper-proven; one authorized post-`f0422b4`
  anchored run proves the capability only; S6 FINAL stays the product
  gate). No open owner question remains on CF1.
- CF2 (E3): "reusable renderer uncommitted" (doc) vs tracked
  `src/lib/xclips/official-bakom-renderer.ts` incl.
  `renderOfficialBakomSequential` (capability, Sep-11 commits). Run: S3
  wired mp4 exists. Doc: workboard wording stale or "reusable" means
  something narrower — clarify in T1, no policy involved.
- CF3 (E5): "S5 NOT STARTED" (doc) vs existing `s5-*` bundle with measured
  QC PASS + open human warnings (run/artifact). Capability exists.
  Resolved: `s5-publish-review-package/` canonical; twin retained as
  historical evidence only, non-canonical, forbidden as pipeline input
  (2026-09-14). Whether `human_review_required` counts as S5 progress is a
  small policy call folded into the future run ticket, not T1.
- CF4: S6 FINAL's no-coding rule (policy, stands) vs dirty E12–E14
  hardening (capability, unit-verified). No conflict of fact: freeze/commit
  first; S6 FINAL stays NOT RUN until then.
- CF5: untracked AI thumbnail generator (capability, exists) vs PRD
  out-of-scope (policy, stands). Default job path confirmed clean
  (`auto-production-service.ts:558`, AI thumbnails only with explicit `s5`
  config). No action beyond keeping it out of production commits.

## Verification runs for this ledger (2026-09-14, non-mutating)

- `bun test tests/xclips/production-trust.test.ts tests/xclips/s4-contract.test.ts tests/xclips/slice-contract.test.ts` → 39 pass, 0 fail.
- `bun test tests/xclips/audio-alignment.test.ts tests/xclips/auto-production-deps.test.ts tests/xclips/ai-dispatch-budget.test.ts` → 36 pass, 0 fail.
- `bun x tsc --noEmit` → exit 0, no diagnostics.
- `git diff --check` → exit 0.
- Environment capability (presence only, nothing executed):
  `~/.cache/xclips/whisper.cpp/build/bin/whisper-cli` present,
  `ggml-small-q5_1.bin` present, `ffmpeg` 8.0.1 + `ffprobe` present.
- Run-record reads, elicitation pass (FILE-level, nothing executed):
  `s6a-fresh-e2e-v6-trust/job-result.json` (fail-closed block, 2026-09-13
  run); `render/physical-alignment/physical-alignment.json` (real whisper
  output, `language: id`, small-q5_1); `s5-publish-review-package/` full
  listing + `physical-timing.json` (no authority field) + twin
  `slice-5-publish-review-package/` listing (same 19,174,469-byte mp4,
  Sep-11 vs Sep-12 iterations); `git ls-files` confirms
  `official-bakom-renderer.ts` tracked, `thumbnail-image-generator.ts`
  untracked.
- NOT run (forbidden for this task): Whisper alignment, media renders,
  external APIs, E2E jobs.

## Evidence inspected

`AGENTS.md`; `docs/product/xclips-production-contract.md`;
`docs/product/auto-production-mvp-prd.md` (§0–§2 + structure);
`docs/architecture/auto-production-mvp11.md` (full, worktree=dirty);
`docs/architecture/auto-production-creative-policy.md` (§1–§2);
`docs/todos.md` (worktree=dirty); `docs/report/` audits (listed);
`docs/archify/{current,target}-state/` (listed);
`config/auto-production/slice-contracts/{s2.json (tracked), s4.json (untracked)}`;
`src/lib/xclips/{production-trust.ts (committed), auto-production-service.ts (committed), audio-alignment.ts (dirty), auto-production-deps.ts (dirty), transcript-chunker.ts (dirty), official-bakom-renderer.ts (tracked)}`;
`src/lib/xclips.service.ts` (dirty, diff);
`src/server/index.ts` + `next.config.ts` (dirty, diff);
`tests/xclips/{production-trust, s4-contract, slice-contract, audio-alignment (dirty), auto-production-deps + ai-dispatch-budget (untracked)}`;
`scripts/e2e-ingest.ts` (untracked, ingest helper);
`artifacts/` slice dirs + `s5`/`slice-5` twins + vault iNews source;
`git log` (`8ba8888`, `db3932d`, `f0422b4`, `3d1596c`, `3cf5750`) and
`git status` baselines in both worktrees.

## Dirty-tree hygiene (not capability claims; do not commit as-is)

- `next.config.ts`: `allowedDevOrigins: ["172.23.132.194"]` is
  machine-specific; revert before any commit.
- `src/server/index.ts`: trailing-newline-only change; harmless, fold into
  next authorized commit or revert.
- Untracked scaffolding (`.agents/skills/`, `.opencode/commands/bmad-*`,
  `_bmad/`, `_bmad-output/`, `docs/archify/`, `docs/archive/`,
  `architecture.visual-check.*`, `scripts/e2e-ingest.ts`,
  `thumbnail-image-generator.ts`, `assets/v10-endcard.png`): keep out of
  production slice commits unless a ticket explicitly adopts each path.

## Recommended first ticket (T1) — doc reconciliation COMPLETE, ready for review

Title: Reconcile trust docs with committed code (CF1) + S3/S5 wording (CF2/CF3).

1. Docs (done in worktree, uncommitted): dirty arch §6 posture updated to
   the committed reality, helpers DATA-not-trust invariant restored,
   stale `executeRenderCoverQc` comment fixed with accurate spec/ledger
   pointers (one hunk, `src/lib/xclips/auto-production-service.ts`);
   CF2/CF3 workboard wording clarified; `s5-publish-review-package/`
   declared canonical with the twin retained historically only.
2. Owner question: ANSWERED by D1 (fail-closed-until-whisper-proven; one
   authorized post-`f0422b4` anchored run proves the capability only; S6
   FINAL stays the product gate).
3. Debt item C re-checked: `tsc --noEmit` exit 0 on 2026-09-14 (twice);
   mismatch claim annotated in arch §9.1, re-verify at closure.
4. No implementation, Whisper/render runs, stage, commit, or push performed.
   S6 FINAL and any commit train stay blocked until the E12–E14 freeze is
   declared. Review the T1 footprint below, then authorize commit or the
   D1-criteria anchored run separately.

T1 footprint (all uncommitted): this ledger (new file);
`docs/architecture/auto-production-mvp11.md` (§6.3, §6.4, §6.5, §6.5.1,
§9.1C — hunks inside pre-existing dirty regions, not independently
stageable); `docs/todos.md` (rule 6, S3/S5 rows, slice-authority line,
R0-rationale note — inside the whole-file rewrite hunk, not independently
stageable); `src/lib/xclips/auto-production-service.ts` (comment-only
hunk, the sole newly-dirty file, independently revertable).

Future anchored-run ticket — required acceptance definitions (NOT invented
here; the ticket must define each before any run): the permitted
real-source class; the durable evidence bundle shape and its canonical
artifact location; what counts as proof of minted authority plus
`production_valid` (which manifest fields, which gate output, retained
where). Until that ticket lands, no run may claim D1 proof.
