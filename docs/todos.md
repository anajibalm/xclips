# xClips Auto Production — MVP Closure Workboard

Canonical plan for the MVP closure sprint (2026-09-08). One active story at a time.
Working principle: keep every story the smallest package that can realistically
be proven E2E; never widen a story for adjacent problems.

## Done

### S1 — Real-media backend proof (PASS)
- Real Metro TV source (`youtube watch?v=7EUk3OE9lqA`, project `proj_1788801264816_1ogi`,
  194-word YouTube CC transcript) driven through the real Hono
  `POST /api/xclips/auto-production/rerender` → `NEEDS_REVIEW`
  (sole reason: sourceDate omitted — no upload_date in persisted sourceMeta).
- Outputs: `output/xclips/auto-production/final_1788835441082.mp4` (h264,
  1080x1920, 30fps, 35.0s, aac audio) + `cover_1788835455040.jpg` (JPEG 1080x1920,
  real source frame). QC 15 PASS / 1 REVIEW / 0 FAIL.
- Subtitles verified visible in output ("SELURUH PEMANTAUAN DILAKUKAN /
  BERDASARKAN DATA DAN", uppercase, safe zone, no karaoke).
- Story blockers fixed in-story (minimal repairs):
  1. `auto-production-service.ts`: default cover output dir to
     `output/xclips/auto-production` (was `""` → ENOENT mkdir crash on all
     three Hono routes when outputDir omitted).
  2. `auto-production-renderer.ts` `buildAutoProductionAss`: missing newline
     between `[Events]` Format line and first Dialogue glued
     (`TextDialogue:`) → libass dropped the whole Events section → every
     Auto Production render shipped zero subtitles. One-line fix + regression
     test (`places every Dialogue event on its own line`).
- Verification: tsc clean; renderer tests 25/25; real-endpoint evidence above.

## Authoritative product decisions (Bakom brief, resolved 2026-09-08)

1. Duration is a permissible range/policy; semantic completeness wins over
   padding/filler; never force a clip longer merely to reach a target.
   CONFLICT on record: current code hard-FAILs statements/renders outside
   30–60s (`orchestrator selectStatement`, QC `media_duration` /
   `contract_statement_duration`), which misclassifies an editorial condition
   as technical inability and contradicts PRD FR-6 (duration problems surface
   as review flags) and FR-13 (doubt → NEEDS_REVIEW, inability → FAILED).
   Unresolved policy, recorded without inventing a number: no product source
   defines what a semantically complete sub-30s statement should become;
   30s stays the range floor that triggers review, not a FAIL threshold,
   pending leadership calibration (cf. PRD OQ-1). → S3.
2. Editorial function is manually selected for MVP. It is the Bakom content
   function/category (e.g. humanization, public education/policy, public
   communication/information integrity, accountability) — NOT the existing
   `hookFormula` (viral hook matrix mechanics: hook matrix entries carry
   emotions such as Alert/Concerned, `transcript-chunker.ts`,
   `types.ts:211`). Separate product field/concept. → S2.
3. Context Integrity is a review gate, never automatic repair. → S5.
4. Sensitive content routes to NEEDS_REVIEW until human review. → S2 (field) + S5 (gate).
5. Bakom watermark/logo is a fixed asset. None exists in the repo
   (no `public/` or `assets/` dir; vault holds only cache/downloads/settings/
   fixtures/db; no preset field; no overlay step) and none may be invented or
   generated — the asset is operator-provided. → S7.
6. SUBTITLE CONTRACT (semantic phrase boundaries + max-word readability
   guardrail + safe/readable rendering) is required equally on generation and
   verification. Generation satisfied (`segmentPhrases`, preset cap 6, S1
   pixel proof); QC verification missing (zero caption checks in
   `auto-production-qc.ts`). → S5.
7. Keep every deliverable the smallest package provable E2E (enforced in
   sequencing below).
8. COPY PACK (publishing caption + CTA + hashtags) is owned by xClips for MVP.
   Zero constructs exist anywhere in `src`; kept distinct from SUBTITLE CONTRACT. → S8.
9. Headline safe-fit must resolve before MVP DONE; was correctly non-blocking
   for S1. → S6 before the final gate.

## Remaining MVP Stories (ordered, dependency order)

### S2 — Manual brief inputs: editorialFunction + sensitivity attestation (NEXT)
- Why required: decisions 2 + 4 (field half). No editorial-function field
  exists in the brief schema/form (it is not `hookFormula`, see decision 2);
  `selectStatement` omits `hookFormula` and falls back to settings `"auto"`;
  zero sensitivity constructs exist in the path.
- Acceptance: brief carries `editorialFunction` (Bakom category, manually
  selected; `hookFormula` behavior unchanged) threaded into planning context;
  sensitivity attestation field present with validation; focused tests
  (pass-through capture test, same pattern as the existing topicPrompt test).
- Non-goals: AI auto-detection of sensitivity (backlog); hook-formula
  changes; any planning-logic redesign.
- Dependency: none.

### S3 — Duration range policy (corrects hard-FAIL conflict)
- Why required: decision 1 + recorded conflict. Minimum-side behavior only:
  a semantically complete but short statement must route to NEEDS_REVIEW
  naming the cause (PRD FR-6), never FAIL; no filler/padding/looping may be
  added to reach a target (assert current trim-only behavior:
  renderer `-ss`/`-t` to statement bounds). Maximum side (60s) unchanged.
- Acceptance: sub-range statement → NEEDS_REVIEW with duration reason (unit +
  service-level tests); e2e fixture still renders exact statement bounds
  (no duration stretching); no new numeric bound invented.
- Non-goals: recalibrating 30s/60s themselves (leadership calibration, OQ-1);
  changing the 60s ceiling.
- Dependency: none (orchestrator + QC mapping only).

### S4 — Real AI planning proof (blocked on operator BYOK credential)
- Why required: H2/H4 planning leg still unproven on the real path.
- Acceptance: with a valid provider key in existing AI Settings (no
  provider-code change expected), real `POST /jobs` full path on the Metro TV
  source using the S2 brief (manual editorialFunction) → AI statement
  selection → READY/NEEDS_REVIEW; then real `/regenerate` (full planning
  again).
- Non-goals: provider marketplace, model discovery, keychain work.
- Dependency: S2 + operator BYOK credential (see Operator dependencies).

### S5 — QC review gates: Context Integrity + SUBTITLE CONTRACT + sensitivity flag
- Why required: decisions 3 + 4 (gate half) + 6 (verification half).
- Acceptance: new REVIEW-only checks (never FAIL, never auto-repair):
  Context Integrity gate, SUBTITLE CONTRACT checks (existence, uppercase,
  ≤6 words per phrase, safe/readable rendering signals), sensitivity-flag
  gate wired to the S2 attestation; unit tests on `runAutoProductionQc`;
  every REVIEW carries a machine-readable reason.
- Non-goals: AI-driven sensitivity detection (backlog); caption re-rendering.
- Dependency: S2 (sensitivity field); best verified against S4 outputs.

### S6 — Headline safe-fit (must precede final gate)
- Why required: decision 9. Evidence unchanged from S1: centered drawtext
  (`x=(w-text_w)/2`, 56px) with no max-width/wrap clips long headlines in
  video (`auto-production-renderer.ts`) and cover (`auto-production-cover.ts`);
  S1 frames show "emerintah … Krakata".
- Acceptance: headline fully inside safe zone on 1080px canvas for long
  inputs; pixel-verified on real render + cover; existing tests green.
- Non-goals: template redesign, per-job styling.
- Dependency: none.

### S7 — Fixed Bakom watermark overlay (operator-provided asset)
- Why required: decision 5. Nothing exists; nothing may be invented.
- Acceptance: operator-supplied fixed logo asset stored in repo, deterministic
  overlay in render (+ cover if decided), pixel-verified, tests; no per-job
  options.
- Non-goals: configurable/uploadable watermarks, animated bugs.
- Dependency: operator logo asset (see Operator dependencies); none in code.

### S8 — COPY PACK: publishing caption + CTA + hashtags
- Why required: decision 8. Kept distinct from SUBTITLE CONTRACT (decision 4
  terminology note in prior audit is superseded: subtitle checks are
  SUBTITLE CONTRACT; this story is COPY PACK only).
- Acceptance: deterministic copy pack derived from brief/headline, returned
  with the job bundle and shown in result UI; unit + API-shape tests.
  (Whether AI-assisted is decided at story start; deterministic template
  satisfies the smallest-package principle if chosen.)
- Non-goals: auto-publishing, scheduling, analytics (PRD §6.2).
- Dependency: none in code; E2E evidence quality wants S4 output.

### S9 — Final real E2E acceptance (full path, after all behavior changes)
- Why required: MVP may not be declared DONE from tests/build alone.
- Acceptance: one real run over the actual application/backend path proving
  end to end: real source → AI planning → manual editorialFunction input →
  review routing → render → subtitles → headline safe-fit → fixed watermark →
  cover → copy pack → QC verdict; ffprobe + visual QC on artifacts.
- Non-goals: new behavior (any failure reopens its owning story).
- Dependency: S2–S8 + operator credential + logo asset.

### S10 — Final engineering gate
- Why required: H5 closure.
- Acceptance: focused + full suite + `tsc --noEmit` + `git diff --check` +
  `next build` + clean tracked diff. No commit/push without explicit user
  instruction (zero auto-commit protocol).
- Dependency: S9.

## Operator dependencies (blocking: S4, S7, S9)

1. Working AI provider key via Settings UI (existing BYOK boundary; no code
   change expected).
2. Fixed Bakom logo asset file (will be stored in repo by the operator;
   nothing generated or invented by engineering).

## Backlog (do NOT implement inside active story)

- AI-driven sensitivity detection (needs S4 planning context + defined
  sensitivity categories; after MVP).
- `hookFormula` changes (explicitly not editorialFunction; leave on `"auto"`).
- Per-job styling overrides, custom BGM upload, batch queues, publishing,
  scheduling, analytics (PRD §6.2, unchanged).
