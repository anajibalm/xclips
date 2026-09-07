---
title: "xClips Auto Production (MVP)"
created: 2026-09-07
updated: 2026-09-07
status: final
---

# PRD: xClips Auto Production (MVP)

## 0. Document Purpose

This PRD is for the product owner and downstream design/engineering owners. It
defines **Auto Production**, a new default workflow on top of the existing
xClips product: an operator files a minimal Production Brief, clicks Generate,
and receives a publish-ready vertical video, thumbnail, and QC result — with
the existing Studio kept as the exception path, not the default.

It is structured with a Glossary-anchored vocabulary (§3); grouped Features
with globally numbered FRs carrying testable consequences (§4); explicit
Non-Goals, Scope, Success Metrics, Open Questions, and an Assumptions Index.
It is product scope only: no architecture, API contracts, schemas, or tickets.

Context inputs (read, not duplicated): `docs/PRD-xclips.md` (v1.1.0, the
current Studio-centric product), `docs/archify/current-state/` (12-component
runtime map: ingest → transcript → AutoClips → Studio → queue → FFmpeg →
vault). Where this PRD changes a standing product assumption, §10 names the
conflict instead of silently rewriting it.

## 1. Vision

Producing a finished short-form news video in xClips today means operating a
capable but manual Studio: choosing cuts on a timeline, styling captions,
placing credits, checking specs. For a high-volume public-communication
desk that work is repetitive — the same standards applied to every video, the
same mechanical checks, the same deterministic formatting.

Auto Production flips the default. The product becomes a **job processor**:
NEW JOB → PROCESSING → READY (or NEEDS REVIEW with stated reasons). The
operator supplies a small Production Brief — source, editorial angle, optional
B-roll, account preset, source metadata, handle — and the system performs the
entire production: ingest, transcription, statement selection, B-roll layout,
preset styling, captions, render, thumbnail, and QC. AI decides only what AI
should decide (which statement matches the angle, which B-roll fits, what the
headline says); everything presentational is owned by deterministic account
presets. Human review happens only where editorial judgment is actually
needed. The Studio remains fully available via Open in Studio — as the
override path for flagged or failed jobs, never the default production path.

## 2. Target User

**Primary user:** an internal content operator/editor producing high-volume
short-form news/public-communication videos. They are not timeline craftspeople
per video; they are throughput owners. Optimize for speed, repeatability, low
friction, consistent standards, deterministic formatting, and review only on
exception.

### 2.1 Jobs To Be Done

- When I have a source video and an editorial angle, I want to file a minimal
  brief so xClips returns a publish-ready video, thumbnail, and QC result
  without me editing every shot. (Functional — realizes UJ-1.)
- When the system is unsure — weak statement, shaky attribution, risky
  B-roll — I want to be told exactly why, so I can fix the input or take over
  in Studio instead of guessing. (Emotional: trust — realizes UJ-2.)
- When a job fails technically, I want a clean failure distinct from editorial
  doubt, so I know whether to retry/fix inputs or escalate. (Realizes UJ-3.)

### 2.2 Non-Users (v1)

External contributors, social-media managers needing auto-publishing, and
anyone wanting custom templates or multi-track craft — all explicitly out
(see §5).

### 2.3 Key User Journeys

- **UJ-1. Operator Ratna ships an eruption-response short without touching the timeline.**
  - **Persona + context:** Ratna runs the desk's short-form output; three source videos and a B-roll folder landed this morning.
  - **Entry state:** xClips open on the Auto Production job list.
  - **Path:** (1) New Job → picks local source video, writes angle
    "Respons pemerintah terhadap dampak erupsi Anak Krakatau", attaches 4
    B-roll clips, enters source name/date, picks Shadow preset + handle.
    (2) Clicks Generate. (3) Watches high-level stage progress.
    (4) Job lands READY with video, thumbnail, QC summary.
  - **Climax:** she previews a 30–60s vertical video with continuous speaker
    audio, contextual B-roll, captions, persistent credit/handle — and never
    opened a timeline.
  - **Resolution:** she opens the output folder and queues the next job.
  - **Edge case:** if the statement is weak, the job lands NEEDS REVIEW with
    reasons instead of a silent mediocre video (→ UJ-2).

- **UJ-2. Operator Bagas resolves a flagged job.**
  - **Persona + context:** Bagas covers QC exceptions on the same desk.
  - **Entry state:** job list shows NEEDS REVIEW with reasons (e.g. missing
    source date, low-confidence B-roll).
  - **Path:** (1) reads the flag reasons; (2) completes the metadata and
    regenerates — or (3) opens in Studio, fixes manually, re-runs QC.
  - **Climax:** the job reaches READY with the flag history preserved.
  - **Resolution:** returns to the queue; Studio edits stay the exception.

- **UJ-3. A job fails cleanly.**
  - **Persona + context:** Ratna, source URL expired mid-ingest.
  - **Entry state:** job shows PROCESSING, then FAILED.
  - **Path:** reads the technical reason, fixes the source, creates a new job.
  - **Climax:** FAILED is never confused with editorial doubt — no Studio
    detour for a broken input.
  - **Resolution:** desk throughput stats count it as a failure, not a review.

## 3. Glossary

- **Job** — one Auto Production run: a Production Brief plus its processing
  lifecycle (NEW → PROCESSING → READY / NEEDS REVIEW / FAILED). One Job
  yields at most one final video.
- **Production Brief** — the minimal operator input: primary source,
  editorial angle, optional B-roll pool, account preset, source metadata
  (source name required at Generate; source date optional at Generate but
  required for READY), account handle.
- **Account Preset** — deterministic production styling owned by an account:
  Shadow, Kabakom. Owns headline/subtitle/credit/handle styles, safe zones,
  layout, transition, BGM, and output rules. Never a separate pipeline.
- **Source Role** — who/what the primary source is (e.g. BAKOM, a TV
  broadcast, another organization/person). Independent of Account Preset.
- **Statement** — one strong, self-contained source utterance selected to
  match the angle; the narrative backbone of the Job.
- **Backbone Audio** — the original speaker/source audio, kept continuous
  across the final video, including under B-roll.
- **B-roll Pool / Placement** — operator-provided real-footage assets, and
  the plan of where each covers the Backbone Audio (video only, never
  replacing speaker audio).
- **READY** — Job verdict: outputs produced and QC passed; publishable
  without timeline inspection.
- **NEEDS REVIEW** — Job verdict: outputs exist but confidence or compliance
  is insufficient; reasons stated; operator resolves or opens in Studio.
- **FAILED** — Job verdict: technical inability to complete; distinct from
  editorial uncertainty.
- **Source Credit** — the rendered persistent attribution (source name +
  date) burned into the final video. Always derives from source metadata,
  never from the Account Preset.
- **Thumbnail / Cover** — the real-frame still image shipped as `cover.jpg`
  with deterministic headline/template treatment. The two words are
  interchangeable in this PRD; never AI-generated imagery.
- **QC Report** — automatic verification record with PASS / WARNING
  (→ NEEDS REVIEW) / FAIL per check.

## 4. Features

### 4.1 Production Brief intake

**Description:** A single small form — the only required operator work.
Accepts local upload or supported web/video URL; angle as free text;
zero-or-more real B-roll assets; Shadow/Kabakom preset; source name + date;
account handle. Low-level controls (FPS, resolution, fonts, safe zones,
transitions, credit placement, BGM volume, loudness target) are never
exposed; they belong to presets and rules. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: File a Production Brief

Operator can create a Job from source + angle + preset + source name +
handle, with optional B-roll pool and optional source date. Realizes UJ-1.

**Consequences (testable):**

- A Job cannot start Generate with a missing source, empty angle, missing
  preset, missing source name, or missing handle; each missing item is
  named inline.
- A missing source date never blocks Generate; it blocks READY and routes
  the Job to NEEDS REVIEW naming the missing date.
- A Job with zero B-roll assets is valid and proceeds without B-roll.
- No routine control (FPS, resolution, font, safe zones, transitions, credit
  placement, BGM volume, loudness) appears on the Brief form.

#### FR-2: Source-role metadata stays independent of preset

Operator can record a Source Role (e.g. BAKOM, TV station, other) that never
changes or constrains the selected Account Preset. Realizes UJ-1.

**Consequences (testable):**

- Changing Shadow ↔ Kabakom never alters recorded source name/date/role.
- The Source Credit rendered on video reflects source metadata, not the preset.

### 4.2 Job processing pipeline

**Description:** After Generate, the Job moves through understandable
high-level stages (Source prepared → Transcript ready → Statement selected →
B-roll planned → Graphics prepared → Rendering → QC). The operator watches
stage progress, never a timeline. Reuses existing xClips behavior (ingest,
transcribe, discover, render, vault) as capabilities. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-3: One-click Generate starts deterministic processing

Operator can start the full pipeline with one Generate action and then wait
without further input on the happy path. Realizes UJ-1.

**Consequences (testable):**

- Generate is the only required action between Brief and verdict.
- The Job reports its current high-level stage at all times during PROCESSING.

#### FR-4: Transcribe only when necessary

The system transcribes the primary source when no usable transcript exists
and proceeds on usable existing transcripts otherwise. Realizes UJ-1.

A transcript is reusable only when it belongs to the same unchanged primary
source, has sufficient timestamp quality, and covers the selected
statement. Age/freshness alone never decides reusability. A
changed/replaced source invalidates its transcript.

**Consequences (testable):**

- A Job with a usable transcript skips re-transcription and still reaches a
  verdict.
- A Job that needs transcription and gets none usable ends FAILED, never
  NEEDS REVIEW.

### 4.3 Statement selection

**Description:** The system selects exactly one strong, self-contained source
statement matching the angle; its audio is the Backbone Audio of a 30–60s
edit. Weak or ambiguous selection must surface as NEEDS REVIEW, not a
mediocre READY. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-5: Select one angle-matching statement

The system selects the single source statement that best matches the
editorial angle as the edit backbone. Realizes UJ-1.

**Consequences (testable):**

- Every finished Job references exactly one selected statement with
  start/end bounds.
- The final video's spoken content comes from that statement's span
  (trimmed only per deterministic rules).

#### FR-6: Flag weak selection instead of shipping it

The system routes unclear, weak, or duration-incompatible selections to
NEEDS REVIEW with a stated reason. Realizes UJ-2.

**Consequences (testable):**

- No Job with an unresolved statement flag reaches READY.
- The flag names the cause (weak match, ambiguous bounds, duration cannot
  satisfy the statement cleanly).

### 4.4 B-roll planning and backbone continuity

**Description:** When the pool allows, the system covers ~25–40% of runtime
with contextual real footage — never forced to hit the percentage — while
Backbone Audio plays continuously underneath. Misrepresentative or
low-confidence placement flags review. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-7: Place contextual B-roll without breaking narration

The system places B-roll video over the Backbone Audio from the provided
pool only. Realizes UJ-1.

**Consequences (testable):**

- B-roll segments reference valid pool assets; unknown/missing assets fail
  the Job, never render silently.
- The speaker audio track is continuous across every B-roll segment; B-roll
  audio never replaces it.
- A Job with an empty pool completes with zero B-roll and is not penalized.

#### FR-8: Refuse forced or misleading B-roll

The system skips B-roll when nothing fits and flags placements that may
materially misrepresent the spoken statement. Realizes UJ-2.

**Consequences (testable):**

- Low-relevance pools yield less (or no) B-roll rather than filler coverage.
- Suspect placements produce NEEDS REVIEW naming the segment and concern.

### 4.5 Preset application (graphics, captions, audio)

**Description:** The Account Preset deterministically renders everything
presentational: persistent upper-zone headline, white plain UPPERCASE
captions (≤6 words/phrase, visible through B-roll, no yellow highlight),
persistent source credit (name + date), persistent handle, preserved
broadcast lower-thirds where materially useful, hard-cut-dominated edits,
silence by default with subtle vocal-free documentary BGM only when the
selected preset defines it (~−14 LUFS final). Vertical
9:16, 1080×1920, 30fps, H.264 or the existing compatible xClips output.
Realizes UJ-1.

**Functional Requirements:**

#### FR-9: Render one preset-determined look

The system applies the selected preset's headline, caption, credit, handle,
safe-zone, layout, transition, and BGM policies with no per-Job styling
decisions. Realizes UJ-1.

**Consequences (testable):**

- Same Brief + same preset regenerates the same styling decisions.
- Captions in final output are white, plain, uppercase, ≤6 words per phrase
  (QC-verified, FR-14).
- No yellow word highlighting appears unless a future preset defines it.
- MVP default audio bed is silence; BGM renders only when the selected
  preset explicitly defines a BGM policy/bed, and its absence never blocks
  READY.

#### FR-10: Preserve source information

The system keeps important original broadcast lower-thirds visible when
materially useful and avoids reframing that destroys source information.
Realizes UJ-1, UJ-2.

**Consequences (testable):**

- When preservation is unsafe, the Job flags NEEDS REVIEW naming the shot.
- Source credit (name + date) and handle are persistent across the full
  duration.

### 4.6 Thumbnail and outputs

**Description:** The Job selects a real frame (source or approved B-roll —
never AI-generated imagery), applies the deterministic headline/template
treatment, and emits `final.mp4`, `cover.jpg`, and the QC report. Realizes
UJ-1.

**Functional Requirements:**

#### FR-11: Produce the output bundle

A finished Job yields final video + real-frame cover + QC report. Realizes
UJ-1.

**Consequences (testable):**

- READY always ships all three artifacts; none is optional.
- The cover derives from a real selected frame, traceable to its timestamp.
- A frame from a B-roll segment flagged for relevance or misrepresentation
  risk is ineligible as the cover; fallback is an eligible frame from the
  primary source or another unflagged approved B-roll asset.

### 4.7 QC and verdicts

**Description:** Automatic QC checks duration (30–60s), 1080×1920, 30fps,
audio presence and approximate loudness, caption existence/uppercase/≤6-word
continuity, headline/credit/handle/date presence, safe zones, valid B-roll
references, B-roll-audio discipline, reasonable B-roll share, and
playability. Verdicts: READY (pass), NEEDS REVIEW (warning/editorial doubt),
FAILED (technical inability). Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-12: Verdict every Job

Every PROCESSING Job ends in exactly one of READY, NEEDS REVIEW, FAILED.
Realizes UJ-1, UJ-2, UJ-3.

**Consequences (testable):**

- READY requires all blocking QC checks passed.
- NEEDS REVIEW always carries at least one machine-readable reason.
- FAILED reasons are technical only (ingest/transcribe/render/asset/output
  failures), never editorial.

#### FR-13: Distinguish doubt from inability

Editorial uncertainty always maps to NEEDS REVIEW; technical inability
always maps to FAILED. Realizes UJ-2, UJ-3.

**Consequences (testable):**

- A QC violation on confidence/compliance never renders FAILED.
- A render/transcribe failure never renders NEEDS REVIEW.

#### FR-14: Enforce the caption contract

QC verifies captions exist, are uppercase, hold ≤6 words per phrase, and
continue across the relevant spoken content including B-roll. Realizes UJ-1.

**Consequences (testable):**

- Any caption breach blocks READY (FAIL or NEEDS REVIEW per severity).

### 4.8 Result experience and Studio escape hatch

**Description:** READY shows preview, status, concise QC summary, thumbnail,
with Open output / Open in Studio / Regenerate actions — no timeline
inspection required. NEEDS REVIEW explains why and offers fix-metadata,
regenerate, or Open in Studio. FAILED states the technical cause and the
fix. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-15: Review without the timeline on READY

Operator can verify and accept a READY Job from preview + QC summary +
thumbnail alone. Realizes UJ-1.

**Consequences (testable):**

- Accepting READY never requires opening Studio or any timeline surface.

#### FR-16: Resolve or escalate flagged Jobs

Operator can complete missing metadata and regenerate, or open the Job in
Studio for manual correction with flag context carried over. Realizes UJ-2.

**Consequences (testable):**

- NEEDS REVIEW reasons remain visible until resolved or Studio-resolved.
- Regeneration preserves the original Brief unless the operator edits it.
- Two distinct actions: Render Again reuses the accepted edit plan and
  rerenders deterministically; Regenerate reruns AI editorial planning and
  may produce different statement/B-roll/headline decisions. Byte-identical
  output is not required. Final UX wording is deferred to the UX workflow.

### 4.9 AI decision boundary (hard rules)

- AI MAY decide/recommend: best angle-matching statement; B-roll semantic
  relevance and approximate placement; suggested headline; thumbnail frame;
  confidence/uncertainty signals. (Covered by FR-5–FR-8, FR-11.)
- AI MUST NOT decide: typography, fonts, caption rules, FPS, resolution,
  safe zones, credit/handle placement, branding, caption word cap,
  transition policy, loudness target, output dimensions. These are preset /
  product rules (FR-9).
- Editorial confidence is tracked as signals separate from the existing
  AutoClips viral/highlight ranking (viral/quality score must not stand in
  for editorial confidence): (a) statement-selection confidence,
  (b) B-roll semantic-relevance / misrepresentation-risk confidence,
  (c) headline confidence. Exact numeric thresholds per signal are a later
  calibration decision (OQ-1).

### 4.10 Deterministic rule boundary

Output contract (MVP): vertical 9:16, 1080×1920, 30fps, H.264 or existing
compatible xClips output, 30–60s, dialogue-dominant audio at ~−14 LUFS
(silence by default; BGM only when the preset defines it), hard cuts
dominant. These numbers are
product rules, changeable only via preset/product updates — never per-Job
AI judgment.

## 5. Non-Goals (Explicit)

- Multi-user collaboration; realtime collaborative editing; cloud rendering.
- Automatic social publishing; stock-footage search engine.
- AI-generated images or video (thumbnail is always a real frame).
- Large transition library; advanced motion-graphics editor; user-built
  template builder; manual multi-track DAW.
- Replacing the existing xClips Studio; a separate Shadow workflow; a
  separate Kabakom workflow.

## 6. MVP Scope

### 6.1 In Scope

- Production Brief intake (§4.1) with the six defined inputs.
- One-click pipeline with seven understandable stages (§4.2).
- Single-statement edit, 30–60s, backbone-continuous audio (§4.3–§4.4).
- Shadow + Kabakom deterministic presets on one pipeline (§4.5, §4.9–§4.10).
- Real-frame thumbnail + output bundle (§4.6).
- Automatic QC with READY / NEEDS REVIEW / FAILED verdicts (§4.7).
- Result experience with Open in Studio escape hatch (§4.8).

### 6.2 Out of Scope for MVP

- Additional presets beyond Shadow/Kabakom (deferred; preset model must
  allow adding them — [NOTE FOR PM] emotionally load-bearing for desk
  expansion).
- Per-Job styling overrides; custom BGM upload.
- Batch/multi-Job queues beyond one-at-a-time Generate.
- Publishing, scheduling, analytics.

## 7. Success Metrics

**Primary**

- **SM-1**: Brief-to-READY median operator time ≤ 5 minutes of hands-on
  work (excludes render wait). Validates FR-1, FR-3, FR-15.
- **SM-2**: ≥ 70% of Jobs reach READY without Studio intervention in the
  acceptance scenario (1 source + angle + 3–5 B-roll + metadata + preset +
  handle). Validates FR-5–FR-9, FR-12.
- **SM-3**: 100% of NEEDS REVIEW Jobs carry specific machine-readable
  reasons. Validates FR-12, FR-16.

**Secondary**

- **SM-4**: Zero READY Jobs with caption-contract or output-spec QC
  breaches on audit sample. Validates FR-10, FR-14.

**Counter-metrics (do not optimize)**

- **SM-C1**: Raw Jobs-per-day — must not rise by shipping weak READYs.
  Counterbalances SM-2.
- **SM-C2**: Regeneration count per Job — must not be gamed down by
  suppressing legitimate flags. Counterbalances SM-3.

## 8. Open Questions

- **OQ-1**: Exact numeric confidence thresholds per signal (statement,
  B-roll, headline) mapping AI uncertainty to NEEDS REVIEW. Decided:
  viral/highlight ranking is not editorial confidence; three separate
  signals are tracked. Only the numeric calibration remains.

## 9. Assumptions Index

- §4.2 (FR-4): transcript reusability is defined by same-unchanged-source,
  timestamp quality, and statement coverage — never by age alone.
- §4.5/§4.10: MVP audio default is silence; BGM only per explicit preset
  policy; no custom BGM upload in MVP.
- §4.9: editorial confidence is three separate signals (statement, B-roll,
  headline), independent of viral/highlight ranking.
- Reuse assumption: ingest, transcription, discovery, rendering, and vault
  behaviors from current xClips are available as capabilities; this PRD does
  not specify how they are invoked.
- OperatorVolume assumption: single-operator desktop use; no concurrency or
  multi-user semantics in MVP.

## 10. Relationship to the existing xClips PRD (conflicts)

`docs/PRD-xclips.md` v1.1.0 defines a **Hybrid model whose primary workspace
is the manual Studio** (AI discovery → visual fine-tune → batch render).
This PRD inverts the default for this workflow: **job processor first,
Studio as exception path**. That is an intentional product-direction delta,
not a rewrite: Studio, presets-as-styles, and the media pipeline are reused,
but the "who decides" boundary moves — editorial micro-decisions move from
operator to system+preset, and timeline craft becomes the override, not the
job. Two further deltas: (a) current PRD's subtitle presets celebrate
Hormozi-style yellow karaoke; Auto Production presets forbid yellow
highlighting by default — a preset-level rule, not a contradiction of the
engine; (b) current PRD has user styling presets, while Auto Production adds
account-owned deterministic production presets (Shadow/Kabakom) — a new
concept that coexists with, and must be kept distinct from, user style
presets and from Source Roles (BAKOM et al.).
