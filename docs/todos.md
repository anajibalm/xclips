# xClips Auto Production — Active Workboard (Canonical S1–S7)

R0/R0.1 recovery baseline: HEAD `db3932d` (`feat: close auto production proper edit slice`),
branch `feat/auto-production-mvp`, recorded 2026-09-11. R0 and R0.1 are docs-only;
neither made any commit.

The canonical roadmap is `docs/architecture/auto-production-mvp11.md` — see the
MVP Slice Roadmap Freeze section, with debt and policies in the Known Debt /
Polish Queue, Blocker Rule, and S4 Source Switch Policy sections.
This file is a tactical pointer only and never overrides that document. Any slice
numbering outside S1–S7 is superseded legacy terminology. The superseded workboard
legacy body is preserved verbatim after the banner (provenance only) in
`docs/archive/auto-production-legacy-workboard-2026-09-08.md` — LEGACY /
NON-CANONICAL / DO NOT USE FOR SLICE STATUS.

## Canonical status (exact)

| Slice | Status |
| :--- | :--- |
| S1 — One Correct Editorial Clip | CLOSED (committed `8ba8888`, pushed) |
| S2 — One Properly Edited Clip | CLOSED (committed `db3932d`, pushed) |
| S3 — One Official BAKOM Reels Draft | FUNCTIONALLY ACCEPTED / ENGINEERING OPEN (presentation accepted on `artifacts/slice-3-official-bakom-draft/official-production-wired.mp4`; closure debt items B–D in the Known Debt / Polish Queue section open; reusable-renderer coverage of debt B–D unconfirmed — `official-bakom-renderer.ts` incl. sequential path IS committed; see ledger CF2) |
| S4 — One Enriched BAKOM Draft | IN PROGRESS / HUMAN_REVIEW_REQUIRED (`artifacts/slice-4-enriched-bakom-draft/s4-final.mp4` + `publish-review-package.json`; framing + source-graphics-collision review open; uncommitted) |
| S5 — One Publish-Review Package | EVIDENCE EXISTS, NOT REVIEWED (`artifacts/s5-publish-review-package/` 2026-09-12: final.mp4 + all-PASS ffprobe QC + human-review warnings; canonical dir per ledger CF3; twin `slice-5-*` retained as historical evidence only — non-canonical, forbidden as pipeline input, decided 2026-09-14) |
| S6 PREFLIGHT (regression evidence) | source-01 PARTIAL (promo tail auto-removed, edges direct, opening mid-sentence) / source-02 FAIL (candidate grounding / range-mapping failure) / source-03 PASS — full pass 1/3, direct edges 2/3 |
| S6 FINAL (MVP 1.1 closure) | NOT RUN |
| S7 — One Source → Five Clips | POST-MVP / NOT STARTED |

## Binding rules (R0.1)

1. Artifact existence is not closure. A directory or a `final.mp4` alone never
   closes a slice; closure needs machine gate + human gate + commit linkage
   (S1/S2), or explicit functional accept with recorded debt (S3).
2. `artifacts/slice-4-enriched-bakom-draft/publish-review-package.json` is S4.1
   evidence (`human_review_required`), not the S5 deliverable.
3. Current S6 sources (`artifacts/slice-6-three-fresh-urls/`, corrected truth
   1/3 in `s6-corrected-truth.json`) are REGRESSION FIXTURES, not final
   acceptance. `source-0*/final.mp4` files do not validate their slices.
4. S6 FINAL requires three unseen URLs processed after code freeze, with no
   coding between runs. The S6 semantic/physical hardening currently in the
   dirty tree must be frozen first.
5. S7 means one source → approximately five independent clips/packages.
   Post-MVP backlog (e.g. large candidate benchmarks) never redefines S7.
6. Production Trust Boundary is COMMITTED/FAIL-CLOSED (owner decision D1,
   2026-09-14; see evidence ledger CF1): canonical physical-timing and
   render producers are committed and wired; the gate fails closed without
   them and no success-path run exists yet (as of 2026-09-14). No provenance string mints
   trust. Do not claim otherwise. One authorized post-`f0422b4` anchored
   run may prove the capability only; S6 FINAL stays the product gate.
7. PRD thumbnail rule: cover/thumbnail is the deterministic treatment of a
   traceable real source or approved B-roll frame only. AI-generated imagery is
   OUT OF SCOPE by PRD and stays out of the production path.
8. Local evidence lives under `artifacts/` (see inventory below). `/tmp/` and
   `output/` are ephemeral/transient and are never durable evidence.
9. No uncommitted implementation is closed. Dirty/untracked work (S3 renderer
   files, S4 artifacts, S6 hardening in `audio-alignment.ts` /
   `auto-production-service.ts` / `auto-production-deps.ts`, thumbnail path,
   this workboard pointer) stays OPEN. No commit path is authorized until the
   R1 dependency-disentangling plan lands; the R0 commit train is rejected
   (see below).

## Local evidence inventory

`artifacts/` is currently untracked. Every path below is workspace evidence,
not Git-durable proof: artifact existence or path alone never closes a slice.
Future closure needs a curated manifest/checksum or other durable linkage.

- S1: `artifacts/slice-1-correct-editorial-clip/final.mp4`
- S2: `artifacts/slice-2-proper-edit/final.mp4` + `final-machine-check.json`
- S3: `artifacts/slice-3-official-bakom-draft/official-production-wired.mp4` + `s3-official-spec.json`
- S4: `artifacts/slice-4-enriched-bakom-draft/s4-final.mp4` + `publish-review-package.json` + `baseline/`
- S6 preflight fixtures: `artifacts/slice-6-three-fresh-urls/s6-corrected-truth.json` + `source-01/` + `source-02/` + `source-03/`
- Slice authority: `config/auto-production/slice-contracts/s2.json` (tracked) + `s4.json` (untracked, P1_CONTRACT_ONLY, as of 2026-09-14); S1/S3/S5–S7 contracts missing

## Next action (R1 — no implementation, no commit)

The R0 commit train is REJECTED and must not be executed. It is rejected because:

- the renderer/trust files have a circular commit-order dependency (renderer
  claims depend on the trust vocabulary while the trust gate depends on the
  renderer wiring);
- (historical R0 rationale, superseded by owner decision D1 — see rule 6:
  at R0 time the production gate could not land while physical and render
  authorities were BLOCKED with no committed producers);
- no commit may leave the production happy path permanently FAILED;
- the AI thumbnail generator is outside MVP scope and must not ride a
  production commit train.

R1 is: define the S3 hard slice contract and produce a
dependency-disentangling plan. No implementation or commit yet. Do not start
S6 FINAL or S7 before that plan lands and a freeze is declared.
