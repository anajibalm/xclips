# Auto Production MVP 1.1 Architecture Freeze

Status: architecture freeze, documentation only
Scope: MVP 1.1 Auto Production
Last frozen: 2026-09-09

This document is canonical for the Auto Production MVP 1.1 architecture,
donor decisions, source-of-truth hierarchy, and deliverable roadmap. It does
not replace the product PRD or the generated Archify diagrams. It prevents
future agents from reinterpreting the production boundary or adopting donor
technology without a slice-level reason.

## 1. Source Of Truth

### Editorial / Production Source Of Truth

1. `MASTER_CREATIVE_BRIEF_STRATEGI_KLIP_KONTEN_BAKOM_RI_FINAL-3.pdf`
   - Editorial meaning
   - Clip structure
   - Tone
   - Context integrity
   - Caption and copy principles
2. Official BAKOM HTML specifications supplied by management
   - Official Reels visual system
   - Official static, layout, and thumbnail system
   - Authoritative visual specifications, not optional inspiration
3. Existing approved xClips S1 implementation
   - Temporary implemented visual proof
   - Adaptable or replaceable where official HTML requires it

**Official HTML visual specification wins over donor project styles.**

The named PDF is not present in the repository at this freeze. Its authority
is contractual and external; absence from this checkout does not lower its
priority. The supplied official BAKOM HTML specifications have the same
authoritative status.

### Physical Timing Hierarchy

- Audio / spoken reality: physical timing source of truth.
- Transcript / words: lexical and semantic source of truth.
- YouTube CC timestamps: alignment hint only.
- AI: editorial decision maker.
- Renderer: deterministic executor.

CC timing must not become physical speech truth merely because it is available.

## 2. Frozen Architecture

```text
SOURCE VIDEO
  -> ingest
  -> spoken timeline
  -> editorial planner
  -> EditPlan
```

Physical boundaries and word timing in `EditPlan` must derive from a
`TrustedPhysicalTimeline` (see §6); semantic planning may use untrusted
semantic evidence. Production output must come from a trusted
`RendererAuthority` through the finalization gate.

`EditPlan` owns, at minimum:

- Final spoken selection and boundaries
- `keepIntervals`
- Subtitle / spoken words
- Headline
- Source / publisher metadata
- `visualEvents`
- `brollPlacements` and material references when available

### A. Editing Layer

Implementation: existing xClips primitives plus deterministic FFmpeg.

Responsibilities:

- `trim` / `atrim`
- `keepIntervals`
- `concat`
- Source audio/video preservation
- Post-cut timeline
- Final physical composition

Current donors: `ffmpeg-builder.ts`, `filler-detector.ts`,
`phrase-segmentation.ts`, `queue.ts`.

### B. Spoken-Timing Layer

WhisperX-class alignment is a candidate implementation.

Responsibilities:

- Real word timing from audio
- Speech and alignment truth

Not responsible for:

- Editorial importance
- Visual design
- Rendering decisions

Adoption status: **CANDIDATE — must pass a real S2/S3 spike first.**

### C. Presentation Layer

Official BAKOM HTML is visual source of truth. HyperFrames is a candidate
renderer and implementation donor.

Responsibilities:

- Timed graphics
- Official BAKOM visual modules
- Lower thirds
- Stats
- Quotes
- Locations
- Maps
- Closing / end card
- Preview and snapshot
- Geometry, safe-zone, and caption-collision QA

### D. Material Layer

MoneyPrinterTurbo is a donor and pattern source.

Responsibilities:

- Ordered material retrieval
- Unique-source prioritization
- Material provenance
- Safe source metadata
- Future batch/task patterns

### Architecture Rule

**AI decides WHAT.**
**Timeline / alignment determines WHEN.**
**Official BAKOM system determines HOW IT LOOKS.**
**Deterministic code executes HOW IT IS RENDERED.**

Never allow:

- AI to directly manipulate final video
- Visual renderer to decide editorial meaning
- CC timestamps to become physical speech truth
- Donor styles to override official BAKOM design
- B-roll provider logic to become editing core

## 3. Visual Events

`visualEvents` is a conceptual planning model only. Do not freeze schema
details before an official BAKOM module requires them.

### Subtitle Ownership

- Canonical spoken/aligned words are the only subtitle timing and content truth.
- Baseline subtitle rendering is derived directly from canonical
  `subtitleWords` / spoken timeline.
- `visualEvents` must not duplicate transcript text or maintain independent
  subtitle timing.
- `subtitle_emphasis` may reference canonical word/range IDs only, or timing
  derived from canonical spoken words.
- Presentation renderers must never create a second subtitle transcript.

Baseline subtitles are separate from the visual-event family below. They are
rendered from canonical spoken words; events only describe optional visual
emphasis or other presentation modules.

Target event family derived from the official Reels HTML:

- `hook`
- `subtitle_emphasis`
- `lower_third`
- `stat`
- `quote`
- `location`
- `map`
- `end_card`

Each event conceptually owns:

- `type`
- `startSec`
- `durationSec`
- `content`
- Optional verified source/data metadata

Planner selects whether an event is needed. Official BAKOM template determines
its visual form. Renderer executes it deterministically.

## 4. Donor Map

### WhisperX

Use:

- Word-level speech alignment
- Audio timing truth

Adoption: **CANDIDATE**. Pass a real S2/S3 spike first.

### MoneyPrinterTurbo

Potential ports:

- Unique-source material ordering
- Ordered search-term retrieval
- Material provenance/source records
- Safe public source URL pattern
- Future batch/task orchestration patterns

Do not port:

- MoviePy renderer
- TTS or script generation
- Random transition system
- Full UI/provider stack

### HyperFrames

Potential adoption:

- Timed visual composition
- HTML/CSS to deterministic motion
- Transparent WebM/MOV overlay
- Preview/snapshot before render
- Geometry, safe-zone, and caption-collision checks
- Lower thirds
- Stat motion
- Maps
- Logo/end-card motion
- `visualEvents`-style timed cards

Do not adopt:

- Brand/style catalog as BAKOM visual source
- Cinematic caption effects by default
- Random visual identities
- Anything contradicting official HTML

Adoption remains a **SPIKE decision**, not a mandatory runtime dependency.

### Donor License Hygiene

When substantial donor code is copied or adapted, preserve all applicable
upstream `LICENSE` / `NOTICE` / attribution requirements and mark modified
files where the upstream license requires it.

## 5. MVP 1.1 Deliverable Roadmap

Roadmap is frozen by deliverable, not feature backlog.

### Slice 1 — One Correct Editorial Clip

Deliverable: one real MP4 where the selected moment is correct, headline is
grounded, source credit is correct, and visual spine is acceptable.

Status: machine proof complete; human closeout pending. Do not mark CLOSED
until human PASS and selective commit.

### Slice 2 — One Properly Edited Clip

Deliverable: one clip that feels properly edited end-to-end.

Acceptance:

- No wrong or mid-word cut
- No awkward dead air
- Subtitle does not precede audible speech
- Audible speech does not continue unsupported by subtitle
- Natural joins
- No gross A/V break

Possible implementation: existing `keepIntervals`, `trim`/`atrim`/`concat`,
`remapWordsToKeepTimeline`, silence/filler primitives, and a WhisperX spike.
Technology is not the deliverable.

### Slice 3 — One Official BAKOM Reels Draft

Deliverable: one edited clip presented using official BAKOM Reels visual grammar.
Start with only modules required by the real clip.

HyperFrames adoption test: port one official BAKOM module first, preferably V5
lower third; render transparent overlay; composite over Slice 2; compare
fidelity and runtime.

- PASS: adopt HyperFrames as presentation renderer.
- FAIL: reuse schema/QC concepts and keep deterministic FFmpeg rendering.

### Slice 4 — One Enriched BAKOM Draft

Deliverable: one draft that does not feel like cropped talking-head-only
content.

Use only when required by content:

- B-roll
- Location
- Stat
- Quote
- Map
- Contextual graphic

MoneyPrinterTurbo donor patterns enter here.

### Slice 5 — One Publish-Review Package

Deliverable bundle:

- `final.mp4`
- `thumbnail.jpg`
- `edit-plan.json`
- `material-sources.json`
- `qc.json`
- Preview frames
- Review flags

Official layout HTML is thumbnail source of truth.

### Slice 6 — Three Fresh Sources

Deliverable: three unseen URLs to three complete packages without coding
between runs. No feature development during acceptance. Failures become
classified failure classes. Three out of three operator-worthy closes MVP 1.1.

### Slice 7 — One Source To Five Clips

Post-MVP deliverable:

```text
source ingest once
  -> transcript/alignment once
  -> 5 EditPlans
  -> 5 independent render jobs
  -> 5 packages
```

Concurrency starts at 1.

## 6. Production Trust Boundary (ARCH.1)

Cross-slice, cross-client invariant. Introduced by ARCH.1. Applies to every
source, client, batch run, and presentation system — not only BAKOM, not only
S4.

### 6.1 Evidence classes are not interchangeable

```text
SemanticEvidence  !=  PhysicalTimingAuthority  !=  RendererAuthority
                  !=  ProductionArtifactValidity
```

- **SemanticEvidence** decides WHAT content matters.
- **PhysicalTimingAuthority** determines WHEN spoken events actually occur.
- **RendererAuthority** determines HOW a production artifact is rendered.
- **ProductionArtifactValidity** is only granted when finalization verifies
  provenance.

A file existing on disk does NOT make it a production artifact.

### 6.2 Semantic evidence

Sources that may inform editorial meaning but never physical timing:
`youtube_cc`, `srt`, `transcript`, `ai`, `metadata`, `manual_editorial`.
Used for story discovery, headline grounding, candidate selection, context
understanding. YouTube CC is always allowed here.

### 6.3 Physical timing authority

The only authority that may define physical spoken timing is
`audio_alignment`, carried by a validated `TrustedPhysicalTimeline`
(`words` + audio `provenance`). Trust is an opaque runtime capability, never a
caller-supplied string.

Explicitly NOT physical authority: `youtube_cc`, `srt`, `cc`, `ai_estimate`,
`synthetic`, `interpolated`, `manual`, `metadata`, `unknown`. Naked
`TimedWord[]` cannot satisfy a physical-timing interface. Pure alignment
helpers (`parseWhisperCppWordOutput`, `mapCanonicalWordsToAudio`) return
DATA, not trust: their outputs never carry the runtime capability no matter
how valid they look.

CANONICAL PHYSICAL AUTHORITY: COMMITTED, SUCCESS PATH UNEVIDENCED —
`runPhysicalAlignment` (`src/lib/xclips/production-trust.ts`, committed
`f0422b4`) executes the committed Whisper.cpp path and mints trusted
timelines through the module-private minter; it is wired into
`executeRenderCoverQc`. S2/S4-era scratch/artifact executions are timing
data, not trust. No run has yet minted trusted timing (nearest run:
v6-trust, 2026-09-13, failed closed on pre-`f0422b4` code). A caller
supplying perfectly valid-looking `WhisperCppTimedWord[]` cannot obtain a
trusted physical timeline. Validation covers authority, non-empty words, audio
provenance, finite timestamps, monotonic ordering, `end >= start`, and rejects
collapsed timing. Posture affirmed by owner decision D1 (2026-09-14; see
`docs/product/xclips-evidence-ledger.md`): fail-closed-until-whisper-proven.

### 6.4 Renderer authority

Renderer identity is generic. `official_bakom` is one implementation of a
trusted `RendererAuthority` (rendererAuthority `official_bakom`,
presentationSystem `bakom-reels-system`). Future client renderers provide their
own authority ids. Scratch/manual identities (`manual`, `scratch`,
`pil_scratch`, `preview`, `experiment`, `unknown`) are never production-valid.

CANONICAL RENDER AUTHORITY: COMMITTED, SUCCESS PATH UNEVIDENCED —
`recordCanonicalBakomRender` mints `official_bakom` trust for validated
1080x1920@30 outputs of the committed sequential renderer
(`renderOfficialBakomSequential`), wired into the default render path. The
`auto-production-renderer.ts` path implements the S1 visual spine
(legacy red accent bar), NOT the accepted official presentation, so it must not
claim `official_bakom`. No run has yet produced a `production_valid`
manifest. Posture affirmed by owner decision D1 (2026-09-14; see
`docs/product/xclips-evidence-ledger.md`).

The generic core must not depend on BAKOM geometry or tokens; the dependency
direction is:

```text
generic trust boundary
        ^
official BAKOM adapter
```

### 6.5 Production finalization gate

`finalizeProductionArtifact` requires a trusted physical timeline, a trusted
canonical render result, and passing QC. It refuses invalid/untrusted inputs and
returns `status: "blocked"` (fail closed). A scratch/manual/tmp render, or a
hand-created PNG overlay, remains `preview` / `experiment` until canonical
production provenance exists.

Policy for the current spoken Auto Production video is fixed by the
architecture: trusted physical timing REQUIRED, canonical renderer REQUIRED, QC
REQUIRED. There are no caller-controlled bypass flags (`physicalTimingRequired`
/ `requiresQc`) and no injectable finalizer override. Finalization is wired into
the canonical service path (`executeRenderCoverQc`), so a job cannot return
`READY` without passing the gate; when trust cannot be established it ends at
`FAILED` / `trust_finalization`. A whisper-anchored run that mints both
authorities and passes QC may yield `production_valid` for the
trust-alignment capability only (owner decision D1, 2026-09-14; see
`docs/product/xclips-evidence-ledger.md`); product acceptance stays with
S6 FINAL. Proof requires durable opening/ending anchor evidence, locked
thresholds and ordering preserved, and no bypass or manual fabrication.

### 6.5.1 Provenance strings and minters

A provenance string such as `rendererAuthority: "official_bakom"` or
`authority: "audio_alignment"` is a descriptive evidence record, NOT runtime
trust. Callers cannot mint trust by supplying matching strings.

Runtime trust is an ephemeral, module-private opaque capability (a unique
`Symbol` that is never exported). There is NO public trust-minter factory:
`production-trust.ts` exposes no
`createPhysicalTimelineMinter` / `createRenderResultMinter` (or equivalent).
Canonical producers are committed (see §6.3–§6.4); they mint trust only
through the module-private path, never from caller-supplied descriptors.
Because the capability is a non-exported symbol, plain
objects, copied metadata, and JSON round-trips cannot reproduce it; serialized
manifests cannot recreate trusted capabilities.

### 6.6 Minimal manifest

Machine-verifiable fields only: `physicalTimingAuthority`,
`physicalTimingProvider`, `rendererAuthority`, `presentationSystem`,
`rendererVersion`, `artifactStatus` (`preview` / `review_ready` /
`production_valid` / `blocked`). No signing, auth framework, or large
metadata graph.

### 6.7 Fail-closed policy

- Trusted physical alignment unavailable → **BLOCK**. Never fall back to
  YouTube CC timestamps.
- Canonical renderer unavailable → **BLOCK** production finalization. Never
  recreate the visual style manually and mark it production valid.
- Alternative implementations may create previews, but never silently become
  production authority.

### 6.8 Relationship to the slice contract

- **SLICE CONTRACT** = what one deliverable is allowed to do (frozen per
  slice; S2 keeps its literal contract).
- **PRODUCTION TRUST BOUNDARY** = what the reusable architecture is
  technically allowed to trust (applies across slices).

## 7. Development Freeze Rule

```text
smallest implementation
  -> focused tests
  -> one real artifact
  -> machine verification
  -> human review
  -> code review
  -> quality gate
  -> selective commit
  -> freeze
```

Do not implement donor technology because it is interesting. Adopt or port a
donor only when it shortens the path to the current slice deliverable.

## 8. Canonical References

- Product scope: `docs/product/auto-production-mvp-prd.md`
- Current runtime map: `docs/archify/current-state/xclips-current-notes.md`
- Existing target diagram notes: `docs/archify/target-state/xclips-auto-production-target-notes.md`
- Existing target diagram data: `docs/archify/target-state/xclips-auto-production-target.architecture.json`
- This file: canonical MVP 1.1 architecture and roadmap freeze

`docs/todos.md` is a tactical workboard. Durable MVP roadmap lives here;
`docs/todos.md` carries only a short S3.6 pointer.

## 9. MVP Slice Roadmap Freeze (S3.6, 2026-09-10)

Use: S1 CLOSED / S2 CLOSED / S3 FUNCTIONALLY ACCEPTED / S4 NEXT /
S5 PLANNED / S6 MVP CLOSURE / S7 POST-MVP SCALE.
Do NOT claim S3 ENGINEERING CLOSED until closure debt (§9.1 B–D) is resolved.

- S1 — ONE CORRECT EDITORIAL CLIP — CLOSED. Right moment, meaning,
  headline, attribution.
- S2 — ONE PROPERLY EDITED CLIP — CLOSED. Physical speech bounds,
  Whisper timing, subtitle lexical integrity, no bad cuts / dead air.
- S3 — ONE OFFICIAL BAKOM REELS DRAFT — FUNCTIONALLY ACCEPTED /
  CLOSURE DEBT REMAINS. Official HTML reaches real production video
  (V1/V3/V4/V5/V10, V1–V10 capability proofed); low-memory sequential
  render completes on current hardware. Human: HTML presentation
  ACCEPTED on `xclips-s3-official-production-wired.mp4`. Known issue:
  source framing too aggressive / too zoomed on this source. Do NOT
  block sprint on one source.
- S4 — ONE ENRICHED BAKOM DRAFT — NEXT. MUST use a fresh URL
  (never reuse the S3 Prabowo source), preferably multi-shot /
  medium-wide / field footage with location context and factual
  B-roll need (§9.3). Proves retrieval/enrichment, contextual module
  selection, provenance, ≥1 thumbnail/cover path; framing observed
  on source #2.
- S5 — ONE PUBLISH-REVIEW PACKAGE — PLANNED. Final QC, provenance
  evidence, caption/copy pack, review-ready output, approval handoff,
  framing QC signal included.
- S6 — THREE FRESH URLS, ZERO MANUAL INTERVENTION — MVP 1.1 CLOSURE.
  3 materially different sources, full path ingest→publish-review
  with no manual timeline editing; goal 3/3.
- S7 — ONE SOURCE → MULTIPLE CLIPS — POST-MVP SCALE. One source to
  ~5 useful clips; editorial diversity; content-factory behavior.
  Not required to close MVP 1.1.

### 9.1 MVP Known Debt / Polish Queue

A. Adaptive source framing / safe composition. Observed: landscape→
portrait path is aggressive full-bleed center crop
(`scale to fill 1080x1920 → crop center`); subject appears too zoomed
on S3 source. Future policy candidates: `full_bleed_crop`,
`fit_with_background`, `subject_aware_reframe`. DO NOT implement yet.
Evidence: record framing PASS/WARN/FAIL for S3, S4, S6 A/B/C. Rule:
single-source issue = OBSERVE; repeated cross-source failure = promote
to MVP POLICY BUG and fix before S6 closure.

B. Low-memory production render. Observed: single giant FFmpeg overlay
graph (14 subtitle PNGs + hook + V5, chained overlays) OOMs under WSL
(~1.9 GB RSS). Working recovery: sequential temporal segments, max 1
heavy FFmpeg, max 1 subtitle PNG input, `threads=1`
(`-threads 1 -filter_threads 1 -filter_complex_threads 1`); measured
peak ~691 MB. Debt: codify into reusable production path instead of
artifact-only execution. Resolve before MVP engineering closure.

C. TypeScript cleanup. Known: `bakom-presentation.ts` quote-type
mismatch (distinct from pre-existing unrelated `thumbnailImageModel`
issue). Fix before MVP closure. (2026-09-14: `bun x tsc --noEmit` exit 0,
no diagnostics — mismatch not reproduced; re-verify at closure.)

D. Final CFR / export normalization. Ensure deterministic
1080×1920, 30 fps CFR, H264, AAC. Close before MVP closure.

E. Small visual tweaks (framing spacing, safe-area breathing room,
typography spacing, credit placement, hybrid mode). Defer unless they
cause clipping, unreadability, factual error, or broken safe-area
compliance. Never interrupt S4/S5 sprint otherwise.

### 9.2 MVP Blocker Rule

A visual issue blocks ONLY on: unreadable content, subject
meaning/context loss, platform-unsafe placement,
factual/provenance problem, or severe composition failure across
multiple sources. Minor aesthetic disagreement = DEFER. Single-source
framing issue = OBSERVE. Repeated cross-source failure = PROMOTE TO
BLOCKER.

### 9.3 S4 Source Switch Policy

S4 MUST NOT reuse the current Prabowo source. Use a fresh URL;
prefer different composition. Criteria: (1) publicly accessible,
(2) Indonesian current-affairs / institutional relevance,
(3) enough speech for one 30–60 s story, (4) multiple visual contexts,
(5) field footage preferred, (6) factual B-roll opportunity,
(7) recently published enough to feel fresh,
(8) no manual source preparation needed. Reason is GENERALIZATION,
not novelty.

### 9.4 S4 Success Definition

S4 succeeds when ONE fresh URL yields: correct editorial clip,
proper timing/cut, official BAKOM presentation, ≥1 factual enrichment
asset, correct provenance, contextual module decision, one
cover/thumbnail path, reviewable final video — AND records framing
outcome PASS / WARN / FAIL. Perfect adaptive framing NOT required
unless framing destroys the clip.
