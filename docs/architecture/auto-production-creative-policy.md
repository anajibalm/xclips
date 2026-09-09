# Auto Production Creative Automation Policy

Status: frozen for MVP 1.1
Scope: creative automation policy and donor adoption depth
Architecture companion: `docs/architecture/auto-production-mvp11.md`

This document freezes how donor projects may influence xClips Auto Production.
It does not authorize S2 work, dependency installation, or runtime adoption.

## 1. Donor Adoption Levels

- **L0 — INSPIRE:** concept, heuristic, or architecture inspiration only. No upstream source code copied.
- **L1 — PORT PATTERN:** reimplement a small upstream pattern using xClips-native TypeScript, FFmpeg, or existing primitives. Do not copy a substantial implementation.
- **L2 — PORT PRIMITIVE:** adapt or copy a small isolated upstream algorithm/helper when materially faster or safer than rewriting it. Keep it bounded and testable. Preserve applicable `LICENSE` / `NOTICE` / attribution requirements.
- **L3 — ADOPT RUNTIME:** use an upstream project, package, or CLI as a bounded runtime dependency behind an xClips adapter. xClips retains orchestration and product architecture.
- **L4 — COPY SUBSYSTEM:** copy and maintain a large upstream subsystem inside xClips.

**MVP 1.1 rule: L4 is forbidden unless explicit architecture replan approves
it.**

## 2. Global Donor Strategy

### WhisperX

Role: speech and alignment truth. Default adoption: **L3 CANDIDATE**.

- Do not port WhisperX internals into xClips.
- Use it behind a narrow alignment adapter only if the real S2 spike passes.
- Reject adoption if Indonesian accuracy, runtime, memory, installation burden,
  or reliability fails the spike.
- License: BSD 2-Clause. Retain required notices when distributed as applicable.

### MoneyPrinterTurbo

Role: material and B-roll donor. Default adoption: **L2** for selected isolated
primitives; **L1** for later orchestration patterns.

Approved L2 ports:

- Unique-source prioritization
- Ordered search-term material retrieval
- Material provenance/source-record shaping
- Safe public source URL sanitation

Approved later L1 inspiration:

- Batch/task orchestration for Slice 7

L0 only:

- Transition abstraction
- BGM type/value UI ideas

Forbidden:

- MoviePy renderer
- TTS/script generation
- Full provider system
- Full WebUI
- Random transition system
- Wholesale copying of `material.py` or `task.py`

MoneyPrinterTurbo must never become an xClips runtime dependency for MVP 1.1.
License: MIT. Preserve copyright and permission notices for copied or
substantial adapted portions.

### HyperFrames

Role: presentation, motion, audio, and QC donor.

#### Concept / Pattern Donor

Use **L0** for:

- Information-density-aware visual pacing
- Semantic visual-module classification
- Restraint and stillness-over-bad-motion principle
- Graceful fallback philosophy

Use **L1** for:

- Audio mixing policy/patterns
- Timed SFX patterns
- Still-image motion
- Opening/closing motion primitives
- Simple presentation fallback logic

Do not copy a large renderer implementation for these patterns.

#### Presentation Runtime

**L3 CANDIDATE beginning in Slice 3.** Required spike:

```text
official BAKOM V5 lower third
  -> exact official geometry/style
  -> HyperFrames composition
  -> transparent overlay
  -> composite over Slice 2 video
  -> compare fidelity
  -> compare render/runtime cost
```

PASS: HyperFrames may become bounded presentation runtime.
FAIL: do not adopt it as runtime; retain relevant L0/L1 concepts only.

If adopted, prefer its built-in renderer, preview, timing, and geometry checks.
Do not adopt runtime and fork/copy its renderer internals at the same time.
Official BAKOM HTML remains visual source of truth.

License: Apache 2.0. If code is copied or modified rather than depended upon,
preserve applicable `LICENSE` / `NOTICE` / attribution and modification notices.

### Donor Impact Is Not Code Copy

A donor may have large architectural or capability impact while contributing
little copied source code:

- WhisperX: high functional impact, near-zero copied code
- HyperFrames: high presentation impact, preferably runtime dependency, not fork
- MoneyPrinterTurbo: medium architecture impact, targeted primitive adaptation
- Official BAKOM HTML: highest visual authority, not a donor
- xClips: product, core orchestration, and editing owner

## 3. Creative Automation Policies

Each policy freezes ownership, donor level, direction, and executable slice.

### P1 — Background Music

- Owner: creative presentation policy
- Donor: HyperFrames
- Level: **L1 default; L2 maximum** for one isolated useful audio primitive
- Executable: Slice 3

AI may classify music intent as `none`, `neutral_institutional`, `tense`,
`reflective`, or `uplifting`. Intent is not a filename. `NONE` is valid by
default. Sensitive or solemn content may force `NONE`. Speech intelligibility
always outranks music. Official technical audio target remains authoritative.
Do not adopt HyperFrames runtime solely for BGM. MoneyPrinterTurbo BGM
type/volume ideas remain L0.

### P2 — Audio Cleanup

- Owner: editing layer
- Donor: HyperFrames audio concepts
- Level: **L1**
- Executable: Slice 2

Use minimal processing only when evidence requires it: denoise/gate if needed,
corrective EQ if needed, conservative compression if needed, and
normalization/limiting. Voice remains natural. Do not copy an audio subsystem;
prefer xClips/FFmpeg-native implementation.

### P3 — Cut / Join

- Owner: xClips editing layer
- Donor: none required; MoneyPrinter transition system is L0 only
- Level: **xClips-native**
- Executable: Slice 2

Official shot language prefers CUT. Physical speech joins come from real S2
listening tests. Do not import dissolve/random transition machinery. A tiny
audio seam/crossfade is allowed only when a real artifact proves it improves
joins without changing speech meaning.

### P4 — SFX

- Owner: presentation layer
- Donor: HyperFrames
- Level: **L1**
- Executable: Slice 3

Default is `NONE`. SFX must be subtle, information-supporting, synchronized to
a meaningful visual event, and appropriate for institutional communication.
No automatic animation-to-whoosh rule.

### P5 — Visual Event Density

- Owner: editorial/presentation policy
- Donor: HyperFrames talking-head density concept
- Level: **L0 only**
- Executable: Slice 3

Use semantic information density: LOW means fewer events and longer holds;
MEDIUM means moderate reinforcement; HIGH means more eligible events and
shorter useful holds. Do not copy card-count formulas or minimum-card rules.
BAKOM restraint overrides donor recommendations.

### P6 — Visual Module Triggers

- Owner: editorial planner
- Donor: HyperFrames category separation
- Level: **L0 only**
- Executable: Slice 3

Initial eligibility rubric:

- Verified speaker identity → lower-third candidate
- Important explicit number → stat candidate
- Strong verbatim sentence → quote candidate
- Materially relevant place → location candidate
- Geographic relationship/orientation needed → map candidate
- Headline/opening communication need → hook candidate
- End of official Reels draft → `end_card` required by official system

Triggers are eligibility signals, not guarantees. Planner asks **does this help
understanding?**, not **can I add a graphic here?**

### P7 — B-Roll

- Owner: material layer + editorial planner
- Donor: MoneyPrinterTurbo
- Level: **L2** for isolated retrieval/provenance primitives
- Executable: Slice 4

Flow:

```text
semantic speech segment
  -> material intent
  -> ordered search terms
  -> candidate retrieval
  -> relevance filtering
  -> unique-source prioritization
  -> placement
  -> provenance record
```

Early search terms must not consume the whole material budget. Do not repeat a
source when equally relevant alternatives exist. B-roll enriches; failure to
find good B-roll falls back to source footage.

### P8 — Still / Image Motion

- Owner: presentation layer
- Donor: official BAKOM HTML/system first; HyperFrames L1 pattern second
- Level: **L1**
- Executable: Slice 3/4 when first still image appears

Official BAKOM restraint wins. Static imagery may use restrained deterministic
motion only. Prefer stillness over bad motion. Donor style cannot override
official motion limits.

### P9 — Opening / Closing Rhythm

- Owner: presentation layer
- Donor: official BAKOM HTML first; HyperFrames motion pattern second
- Level: **L1**, or naturally through L3 if runtime is adopted
- Executable: Slice 3

Hook and end card remain independent official modules. HyperFrames may determine
how motion executes, never BAKOM identity. Exact durations come from official
specification plus the first real Slice 3 artifact; do not invent global
durations now.

### P10 — QA / Fallback

- Owner: orchestration/QC
- Donor: HyperFrames + MoneyPrinterTurbo philosophy
- Level: **L3 built-in checks if runtime is adopted; otherwise L1 only for needed checks**
- Executable: Slice 3 onward; fully enforced in Slice 5

Failure hierarchy:

- Core failure: invalid speech/edit/source/context → FAIL job
- Presentation failure: collision/overflow/module issue → retry simpler official presentation; then review or allowed fallback
- Enrichment failure: unavailable B-roll/material → retain source footage; do not fail core video
- Auxiliary failure: non-critical provenance/preview issue → `NEEDS_REVIEW` where appropriate; never corrupt main render

Never silently fabricate missing editorial or source truth.

## 4. Source Priority

For conflicts:

- Editorial: Master Creative Brief wins
- Visual: official BAKOM HTML wins
- Physical speech timing: audio/aligned spoken reality wins
- Edit execution: xClips deterministic editing primitives win
- Donor repository: never overrides any of the above
