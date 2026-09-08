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

### S2 — Manual brief inputs: editorialFunction + sensitivity attestation (PASS)
- Why required: decisions 2 + 4 (field half). No editorial-function field
  existed in the brief schema/form (it is not `hookFormula`, see decision 2);
  `selectStatement` omitted `hookFormula` and fell back to settings `"auto"`;
  zero sensitivity constructs existed in the path.
- Implemented: `ProductionBriefSchema` gains required `editorialFunction`
  (free string, manually selected; no invented enum lock-in) and
  `sensitiveContent: boolean` (default false, backward compatible);
  threading `selectStatement → deps.discoverHighlights → xclipsService →
  buildHighlightPrompt` as `EDITORIAL FUNCTION CONTEXT` (additive optional
  params only; `hookFormula` path untouched); form select with the four Bakom
  categories + sensitivity attestation checkbox + Generate gate;
  client-safe `buildAutoProductionBrief` extended.
- Verification: tsc clean; focused 114/114 (5 files); full suite 252/252
  (+7 new: schema validation/defaults, orchestrator capture incl.
  `hookFormula` absence, builder passthrough, prompt context
  present/absent); factories updated mechanically, no assertions weakened.
- Non-goals (held): AI auto-detection of sensitivity (backlog); hook-formula
  changes; planning-logic redesign.
- Dependency: none. Unblocks S4 (real AI planning uses this brief).

### S3 — Duration range policy (corrects hard-FAIL conflict) (PASS)
- Why required: decision 1 + recorded conflict. Minimum-side behavior only:
  a semantically complete but short statement routes to NEEDS_REVIEW naming
  the cause (PRD FR-6), never FAIL; no filler/padding/looping added to reach
  a target (trim-only render asserted); maximum side (60s) unchanged.
- Implemented: orchestrator `selectStatement` — over-60s still technical
  FAILED (message unchanged), zero/negative span fails as malformed bounds,
  positive sub-30s proceeds with `statementSignal` review + machine-readable
  warning (`25.0s below 30s review threshold … no filler added`); QC
  `media_duration` + `contract_statement_duration` map sub-30s to REVIEW
  (same numbers in message), over-60s stays FAIL. No new numeric bound.
- Verification: tsc clean; focused orchestrator+service+QC 81/81; e2e-smoke
  3/3 incl. new real-render proof (25s statement → exact 10–35s bounds,
  NEEDS_REVIEW with duration reason, real files produced); full suite
  255/255 (+3). No filler/padding/looping code exists or was added.
- Non-goals (held): recalibrating 30s/60s (OQ-1); changing the 60s ceiling.
- Dependency: none. Unblocks correct NEEDS_REVIEW routing for S4 outputs.

### S4 — Real AI planning proof (PASS)
- Real Gemini planning remains proven, but original runs exposed a semantic
  blocker: `/jobs` and `/regenerate` called ingest every time. Each call
  minted a new project, so persisted project `proj_1788801264816_1ogi` and
  transcript `tr_yt_1788801272342` were not reused. `/regenerate` also
  retranscribed, violating same source/project + same transcript semantics.
- Existing real-provider evidence retained: direct Gemini
  (`https://generativelanguage.googleapis.com/v1beta`, model
  `gemini-3.7-flash` after correcting stale `gemini-3-7-flash` 404); prior
  successful runs returned `NEEDS_REVIEW`, rendered video + cover, and QC
  15 PASS / 1 REVIEW / 0 FAIL. Transient Gemini 503 overloads remain noted;
  no retry infrastructure added.
- Smallest repair: `getAutoProductionDeps()` now resolves oldest persisted
  project with exact local source identity, existing media, and usable
  transcript; orchestrator reuses it before ingest. Miss/error falls through
  to existing ingest path. No provider or API redesign.
- Real repaired `/jobs` (`s4-reuse-jobs-003`): project remained
  `proj_1788801264816_1ogi`; transcript remained
  `tr_yt_1788801272342` (194 words); no transcription dispatch; Gemini
  Map-Reduce planning executed; EditPlan 44–87s, headline
  "Panduan Warga Hadapi Abu Vulkanik"; render
  `output/xclips/auto-production/final_1788846108205.mp4` + cover
  `cover_1788846120478.jpg`; QC 15 PASS / 1 REVIEW / 0 FAIL.
- Real repaired `/regenerate` (`s4-reuse-regen-001`): same project ID and
  same transcript ID/word count; no transcription dispatch; Gemini planning
  executed again; EditPlan 42–85s, headline "Panduan Menghadapi Abu
  Vulkanik"; render `output/xclips/auto-production/final_1788846143122.mp4`
  + cover `cover_1788846155136.jpg`; QC 15 PASS / 1 REVIEW / 0 FAIL.
- Focused orchestrator tests: 32 PASS. `tsc --noEmit` clean. Full suite
  not a gate: 256 PASS, 3 pre-existing real-render timeout failures in
  `auto-production-e2e-smoke.test.ts` (5s test timeout); S5 work remained scoped.
- Semantic blocker closed: both real calls now record stable project and
  transcript identities, planning twice, and zero transcription dispatches.
- Non-goals held: provider marketplace, model discovery, keychain work;
  no watermark, headline-fit, copy-pack, or later QC story changes.

### S5 — QC review gates: Context Integrity + SUBTITLE CONTRACT + sensitivity flag (PASS)
- Why required: decisions 3 + 4 (gate half) + 6 (verification half).
- Implemented deterministic REVIEW-only gates. Context Integrity uses one
  minimum human attestation field, `contextIntegrityConfirmed`; false,
  undefined, or omitted emits `editorial_context_integrity` REVIEW. True
  emits same stable check as PASS. Checklist remains human-authoritative;
  no AI fact-checking or semantic repair.
- `sensitiveContent: true` emits `editorial_sensitive_content` REVIEW and
  routes final verdict to `NEEDS_REVIEW`; false emits no sensitivity reason.
- Subtitle contract receives renderer transcript words through service QC
  wiring. Explicit missing words emits `subtitle_contract_missing` REVIEW;
  invalid statement-relative timing emits `subtitle_contract_timing` REVIEW;
  phrase segmentation uses existing `segmentPhrases` and preset cap, with
  over-six-word evidence emitting `subtitle_contract_max_words` REVIEW.
  Uppercase is reported deterministically as
  `subtitle_contract_uppercase` PASS from preset transform configuration;
  compliant phrases emit `subtitle_contract` PASS. No subtitle rewrite or
  re-render added. Legacy direct QC callers without transcript words remain
  compatible; explicit empty artifact remains REVIEW.
- Existing technical FAIL checks, sourceDate review, and S3 duration policy
  preserved. Multiple review checks coexist without overwriting.
- Verification: focused QC/service/orchestrator/types/API tests 135/135 PASS;
  `tsc --noEmit` clean. Full suite 264 PASS / 3 FAIL, same known
  `auto-production-e2e-smoke.test.ts` 5-second real-render timeouts; no S6
  work started.
- Files: `src/lib/xclips/auto-production-qc.ts`,
  `src/lib/xclips/auto-production-service.ts`,
  `src/lib/xclips/auto-production-types.ts`,
  `src/lib/xclips/auto-production-api.ts`,
  `src/app/xclips/auto-production/page.tsx`,
  `tests/xclips/auto-production-qc.test.ts`.
- Non-goals: AI-driven sensitivity detection (backlog); caption
  re-rendering; headline safe-fit, watermark, copy pack, final E2E.
- Dependency: S2 (sensitivity field); S4 closed.

### S6 — BAKOM Deterministic Portrait Visual System (PASS / CLOSED)
- C1 PASS: spoken subtitles use canonical `captionTop = 1476` with ASS
  `\\an8\\pos(540,1476)`; BROLL bottom remains 1440. Position independent of
  source orientation, content type, and zoom.
- C2 PASS: headline uses white 48px text, 10px line spacing, permanent red
  left accent bar, fixed 300ms fade + subtle slide-up, max 3 lines, balanced
  deterministic wrapping, orphan-final-line penalty, and weak connector
  (`dan`, `atau`, `yang`, `untuk`, `dari`, `dengan`) line-end penalty.
- C3 PASS: human accepted real Metro `news_talking_head` framing at locked
  zoom `1.20`. Output remains 1080x1920; BROLL geometry and footer anchoring
  unchanged. Video visual system closed.
- Human visual acceptance completed using real Metro artifacts, including
  subtitle frames, headline frames, and zoom frame. Latest C3 artifact:
  `/tmp/opencode/s6-c3-zoom120/final_1788877450157.mp4` with frame
  `/tmp/opencode/s6-c3-zoom120/frame.png`.
- Canonical constants and transform rules live in
  `src/lib/xclips/auto-production-bakom-layout.ts`; renderer and cover share
  deterministic geometry. Future invariant preserved: source → transcript →
  N EditPlans, each independently renderable. No batch orchestration added.
- S6-T NEXT: AI-generated editorial thumbnail remains separate from final
  video; deterministic text overlay and source-reference safety remain the
  contract. Provider image generation stays unverified and deferred.
- Non-goals: S7 official logo/watermark, S8 copy pack, S9 final real E2E, S10
  engineering gate, provider redesign, batch/queue/workers.
- Dependency: none.

### S7 — Fixed Bakom watermark overlay (operator-provided asset) (NEXT)
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
