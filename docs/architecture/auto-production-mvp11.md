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

## 6. Development Freeze Rule

Each slice follows:

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

## 7. Canonical References

- Product scope: `docs/product/auto-production-mvp-prd.md`
- Current runtime map: `docs/archify/current-state/xclips-current-notes.md`
- Existing target diagram notes: `docs/archify/target-state/xclips-auto-production-target-notes.md`
- Existing target diagram data: `docs/archify/target-state/xclips-auto-production-target.architecture.json`
- This file: canonical MVP 1.1 architecture and roadmap freeze

`docs/todos.md` is a workboard with unrelated local changes. It is not an
architecture source and remains untouched.
