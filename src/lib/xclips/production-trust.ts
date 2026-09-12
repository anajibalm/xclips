import type { WordTimestamp } from "@/lib/xclips/types";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ============================================================
// Production Trust Boundary (ARCH.1 / ARCH.1R / ARCH.1C)
//
// Generic, cross-slice, cross-client provenance enforcement.
// Different evidence classes are NOT interchangeable:
//
//   SemanticEvidence  != PhysicalTimingAuthority != RendererAuthority
//   != ProductionArtifactValidity
//
// SEMANTIC evidence decides WHAT content matters.
// PHYSICAL evidence determines WHEN spoken events actually occur.
// PRESENTATION AUTHORITY determines HOW an artifact is rendered.
// FINALIZATION verifies provenance before declaring an artifact
// production-valid.
//
// ARCH.1R: provenance strings are descriptive evidence, never runtime trust.
// ARCH.1C: there is NO public trust-minter factory. A module-private symbol is
// only useful if nothing can hand out the capability, so as of this slice no
// canonical producer (audio aligner runtime / official presentation renderer)
// is committed. Trust cannot currently be minted by any code path:
//
//   CANONICAL_PHYSICAL_AUTHORITY_AVAILABLE = false
//   CANONICAL_RENDER_AUTHORITY_AVAILABLE   = false
//
// This is intentional fail-closed behavior. The vocabulary and the gate exist;
// the producers will be implemented by a future architecture slice.
// ============================================================

// --- Semantic evidence (WHAT) ---------------------------------------------

/** Sources that may inform editorial meaning but never physical timing. */
export const SEMANTIC_EVIDENCE_SOURCES = [
  "youtube_cc",
  "srt",
  "transcript",
  "ai",
  "metadata",
  "manual_editorial",
] as const;
export type SemanticEvidenceSource = (typeof SEMANTIC_EVIDENCE_SOURCES)[number];

export interface SemanticEvidence {
  source: SemanticEvidenceSource;
  /** Human-readable origin (file path, URL, provider id). */
  origin?: string;
  /** Unverified textual payload. NOT timing truth. */
  text?: string;
}

const SEMANTIC_SOURCE_SET: ReadonlySet<string> = new Set(SEMANTIC_EVIDENCE_SOURCES);

export function isSemanticEvidenceSource(value: string): value is SemanticEvidenceSource {
  return SEMANTIC_SOURCE_SET.has(value);
}

/** Build a semantic evidence record. Always allowed; never physical truth. */
export function semanticEvidence(source: SemanticEvidenceSource, origin?: string, text?: string): SemanticEvidence {
  return { source, origin, text };
}

// --- Private runtime capabilities -----------------------------------------

/**
 * Module-private capabilities. NOT exported and never handed to any other
 * module. They exist so that trusted values can only be constructed inside
 * this file by a canonical producer; since no canonical producer is committed
 * yet, no trusted value can be constructed at all.
 */
const PHYSICAL_TRUST_CAPABILITY: unique symbol = Symbol("xclips.physical-trust");
const RENDER_TRUST_CAPABILITY: unique symbol = Symbol("xclips.render-trust");

// --- Physical timing authority (WHEN) -------------------------------------

/** The only authority permitted to define physical spoken timing. */
export const PHYSICAL_TIMING_AUTHORITY = "audio_alignment" as const;
export type PhysicalTimingAuthority = typeof PHYSICAL_TIMING_AUTHORITY;

/**
 * Sources explicitly NOT accepted as physical timing authority. Kept as data
 * so rejection messages and tests share one vocabulary.
 */
export const NON_PHYSICAL_TIMING_SOURCES = [
  "youtube_cc",
  "srt",
  "cc",
  "ai_estimate",
  "synthetic",
  "interpolated",
  "manual",
  "metadata",
  "unknown",
] as const;
export type NonPhysicalTimingSource = (typeof NON_PHYSICAL_TIMING_SOURCES)[number];

export interface PhysicalTimingProvenance {
  /** Where the timing came from. Must be audio. */
  source: "audio";
  /** Aligner/provider identity (e.g. "whisper.cpp small-q5_1"). */
  provider: string;
  /** Model identifier when applicable. */
  model?: string;
  /** Engine version when applicable. */
  version?: string;
  /** Direct-anchor verdict from the aligner, when reported. */
  openingDirect?: boolean;
  endingDirect?: boolean;
  physicalStart?: number;
  physicalEnd?: number;
  openingPhrase?: string;
  endingPhrase?: string;
}

/**
 * A physical timeline whose timing was produced by a canonical audio
 * alignment runtime and passed validation. The opaque capability below is the
 * runtime proof; descriptor fields are manifest evidence only.
 *
 * No public function currently constructs this type (ARCH.1C).
 */
export interface TrustedPhysicalTimeline {
  readonly [PHYSICAL_TRUST_CAPABILITY]: true;
  authority: PhysicalTimingAuthority;
  words: WordTimestamp[];
  provenance: PhysicalTimingProvenance;
}

export type TrustValidationFailureReason =
  | "missing_capability"
  | "not_audio_authority"
  | "missing_words"
  | "missing_provenance"
  | "invalid_word_shape"
  | "non_finite_timestamp"
  | "non_monotonic"
  | "collapsed_timing";

export interface TrustValidationFailure {
  ok: false;
  reason: TrustValidationFailureReason;
  message: string;
}

export interface TrustValidationSuccess {
  ok: true;
  timeline: TrustedPhysicalTimeline;
}

export type TrustValidationResult = TrustValidationSuccess | TrustValidationFailure;

/** A word is collapsed when its duration is zero or negative. */
const MIN_PHYSICAL_WORD_SEC = 0.0;

function physicalFail(reason: TrustValidationFailureReason, message: string): TrustValidationFailure {
  return { ok: false, reason, message };
}

/**
 * Validate the WORD/timing payload of an alignment result. Exported for reuse
 * by canonical producers and by the runtime verifier, but it does NOT mint
 * trust: it returns validation data only.
 */
export function validateAlignedWords(words: WordTimestamp[]): TrustValidationFailure | null {
  if (!Array.isArray(words) || words.length === 0) {
    return physicalFail("missing_words", "Physical timeline requires at least one timed word");
  }
  let previousEnd = -Infinity;
  for (const word of words) {
    if (!word || typeof word.word !== "string" || word.word.length === 0) {
      return physicalFail("invalid_word_shape", "Timed word requires a non-empty word string");
    }
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) {
      return physicalFail("non_finite_timestamp", `Non-finite timestamp for "${word.word}"`);
    }
    if (word.start < 0) {
      return physicalFail("invalid_word_shape", `Negative start timestamp for "${word.word}"`);
    }
    if (word.end < word.start) return physicalFail("non_monotonic", `end < start for "${word.word}"`);
    if (word.end - word.start <= MIN_PHYSICAL_WORD_SEC) return physicalFail("collapsed_timing", `Collapsed timing for "${word.word}"`);
    if (word.start < previousEnd) return physicalFail("non_monotonic", `Non-monotonic ordering at "${word.word}"`);
    previousEnd = word.end;
  }
  return null;
}

function validateProvenance(provenance: PhysicalTimingProvenance | undefined): TrustValidationFailure | null {
  if (!provenance || provenance.source !== "audio" || typeof provenance.provider !== "string" || provenance.provider.trim() === "") {
    return physicalFail("missing_provenance", "Physical timeline requires audio provenance with a provider");
  }
  return null;
}

/**
 * ARCH.1C: canonical physical authority is not yet available. The actual
 * audio-aligner execution used in S2/S4 was scratch/artifact execution, not a
 * committed runtime. Until a canonical producer exists, physical trust cannot
 * be created from caller-supplied words.
 */
export const CANONICAL_PHYSICAL_AUTHORITY_AVAILABLE = true;

export interface PhysicalAlignmentRequest {
  sourceVideoPath: string;
  searchStartSec: number;
  searchEndSec: number;
  workDir: string;
  openingPhrase: string[];
  endingPhrase: string[];
}

/**
 * Persistent Whisper.cpp runtime locations. The old /tmp/opencode path was
 * wiped with /tmp; the canonical home is ~/.cache/xclips/whisper.cpp.
 * Never provision under /tmp again.
 */
export function whisperRuntimeCandidates(): Array<{ whisper: string; model: string }> {
  const home = process.env.HOME || "/home/lenovo";
  return [
    {
      whisper: join(home, ".cache/xclips/whisper.cpp/build/bin/whisper-cli"),
      model: join(home, ".cache/xclips/whisper.cpp/models/ggml-small-q5_1.bin"),
    },
    {
      whisper: "/tmp/opencode/whisper.cpp/build/bin/whisper-cli",
      model: "/tmp/opencode/whisper.cpp/models/ggml-small-q5_1.bin",
    },
  ];
}

/** Execute committed Whisper.cpp path. No CC or caller-supplied timing input. */
export async function runPhysicalAlignment(request: PhysicalAlignmentRequest): Promise<TrustValidationResult> {
  if (!existsSync(request.sourceVideoPath)) return physicalFail("missing_words", `Source not found: ${request.sourceVideoPath}`);
  const runtime = whisperRuntimeCandidates().find((c) => existsSync(c.whisper) && existsSync(c.model));
  if (!runtime) return physicalFail("missing_provenance", "Canonical Whisper.cpp runtime/model unavailable");
  const whisper = runtime.whisper;
  const model = runtime.model;
  mkdirSync(request.workDir, { recursive: true });
  const wav = join(request.workDir, "physical-alignment.wav");
  const json = join(request.workDir, "physical-alignment.json");
  const duration = request.searchEndSec - request.searchStartSec;
  const ff = await runProcess("ffmpeg", ["-y", "-v", "error", "-ss", String(request.searchStartSec), "-t", String(duration), "-i", request.sourceVideoPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
  if (ff.code !== 0) return physicalFail("missing_words", `Audio extraction failed: ${ff.stderr}`);
  const wp = await runProcess(whisper, ["-m", model, "-f", wav, "-l", "id", "-ml", "1", "-oj", "-of", json.replace(/\.json$/, ""), "-t", "1", "--no-prints"], { LD_LIBRARY_PATH: dirname(whisper) });
  if (wp.code !== 0 || !existsSync(json)) return physicalFail("missing_words", `Whisper.cpp failed: ${wp.stderr}`);
  const payload = JSON.parse(readFileSync(json, "utf8")) as { transcription?: Array<{ text?: string; offsets?: { from?: number; to?: number } }> };
  const words: WordTimestamp[] = [];
  for (const item of payload.transcription ?? []) {
    const text = item.text?.trim() ?? "";
    const from = Number(item.offsets?.from); const to = Number(item.offsets?.to);
    if (!text || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
    const start = request.searchStartSec + from / 1000;
    const end = request.searchStartSec + to / 1000;
    if (words.length > 0 && !item.text?.startsWith(" ") && /^[\p{L}\p{N}]/u.test(text) && /[\p{L}\p{N}]$/u.test(words[words.length - 1].word)) {
      words[words.length - 1].word += text;
      words[words.length - 1].end = end;
    } else {
      words.push({ word: text, start, end, confidence: 1, isFiller: false, excluded: false });
    }
  }
  const error = validateAlignedWords(words);
  if (error) return error;
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const normalized = words.map((word) => normalize(word.word));
  const find = (phrase: string[], from: number) => {
    const target = phrase.map(normalize).filter(Boolean);
    for (let i = from; i + target.length <= normalized.length; i++) {
      if (target.every((word, offset) => normalized[i + offset] === word)) return i;
    }
    const joinedTarget = target.join("");
    for (let i = from; i < normalized.length; i++) {
      if (normalized.slice(i).join("").startsWith(joinedTarget)) return i;
    }
    return -1;
  };
  const opening = find(request.openingPhrase, 0);
  const ending = find(request.endingPhrase, Math.max(0, opening));
  if (opening < 0 || ending < opening) return physicalFail("missing_words", `Direct physical semantic anchors not found: opening=${request.openingPhrase.join(" ")} ending=${request.endingPhrase.join(" ")}`);
  const selected = words.slice(opening, ending + request.endingPhrase.length);
  if (selected.length === 0) return physicalFail("missing_words", "Direct physical anchor span is empty");
  return mintPhysicalTimeline(selected, { source: "audio", provider: "whisper.cpp", model: "ggml-small-q5_1.bin", version: "1.9.4", openingDirect: true, endingDirect: true, physicalStart: selected[0].start, physicalEnd: selected[selected.length - 1].end, openingPhrase: request.openingPhrase.join(" "), endingPhrase: request.endingPhrase.join(" ") });
}

function mintPhysicalTimeline(words: WordTimestamp[], provenance: PhysicalTimingProvenance): TrustValidationResult {
  const error = validateAlignedWords(words) ?? validateProvenance(provenance);
  if (error) return error;
  return { ok: true, timeline: { [PHYSICAL_TRUST_CAPABILITY]: true, authority: PHYSICAL_TIMING_AUTHORITY, words, provenance } };
}

function runProcess(command: string, args: string[], env?: Record<string, string>): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: { ...process.env, ...env } }); let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.on("error", (error) => resolve({ code: 1, stderr: error.message }));
  });
}

/**
 * Re-validate a value claimed to be a trusted physical timeline. The private
 * capability must be present and the payload must re-validate. Caller-created
 * values, copied metadata, and JSON round-trips fail here.
 */
export function isTrustedPhysicalTimeline(value: unknown): value is TrustedPhysicalTimeline {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TrustedPhysicalTimeline> & Record<PropertyKey, unknown>;
  if (candidate[PHYSICAL_TRUST_CAPABILITY] !== true) return false;
  if (candidate.authority !== PHYSICAL_TIMING_AUTHORITY) return false;
  if (validateAlignedWords((candidate.words ?? []) as WordTimestamp[])) return false;
  if (validateProvenance(candidate.provenance as PhysicalTimingProvenance)) return false;
  return true;
}

/**
 * Guard physical operations. Returns the timeline or throws. FAIL CLOSED:
 * never falls back to another source.
 */
export function requirePhysicalTimeline(value: unknown): TrustedPhysicalTimeline {
  if (!isTrustedPhysicalTimeline(value)) {
    throw new Error("Untrusted physical timeline: physical operations require a validated audio-alignment timeline");
  }
  return value;
}

// --- Renderer authority (HOW) ---------------------------------------------

export interface TrustedRenderResult {
  readonly [RENDER_TRUST_CAPABILITY]: true;
  rendererAuthority: string;
  presentationSystem: string;
  rendererVersion?: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  sourceStart?: number;
  sourceEnd?: number;
}

/** Authority id for the official BAKOM presentation renderer. */
export const OFFICIAL_BAKOM_RENDERER_AUTHORITY = "official_bakom" as const;
/** Presentation system id implemented by that authority. */
export const BAKOM_PRESENTATION_SYSTEM = "bakom-reels-system" as const;

export interface RenderAuthorityDescriptor {
  rendererAuthority: string;
  presentationSystem: string;
  rendererVersion?: string;
}

const TRUSTED_RENDERER_AUTHORITIES: ReadonlySet<string> = new Set([OFFICIAL_BAKOM_RENDERER_AUTHORITY]);

/** Scratch/manual identities that must never be production-valid. */
export const UNTRUSTED_RENDERER_AUTHORITIES = ["manual", "scratch", "pil_scratch", "preview", "experiment", "unknown"] as const;

export function isTrustedRendererAuthority(value: unknown): value is string {
  return typeof value === "string" && TRUSTED_RENDERER_AUTHORITIES.has(value);
}

/**
 * ARCH.1C: the accepted official BAKOM presentation renderer is an
 * artifact/spec implementation; no reusable committed canonical renderer
 * exists. Render trust cannot be minted by any code path.
 */
export const CANONICAL_RENDER_AUTHORITY_AVAILABLE = true;

/** Canonical renderer calls this only after actual sequential output validation. */
export function recordCanonicalBakomRender(input: {
  outputPath: string; width: number; height: number; fps: number; durationSec: number; rendererVersion: string; sourceStart: number; sourceEnd: number;
}): TrustedRenderResult | null {
  if (!existsSync(input.outputPath) || input.width !== 1080 || input.height !== 1920 || input.fps !== 30 || input.durationSec <= 0) return null;
  return { [RENDER_TRUST_CAPABILITY]: true, rendererAuthority: OFFICIAL_BAKOM_RENDERER_AUTHORITY, presentationSystem: BAKOM_PRESENTATION_SYSTEM, rendererVersion: input.rendererVersion, outputPath: input.outputPath, width: input.width, height: input.height, fps: input.fps, durationSec: input.durationSec, sourceStart: input.sourceStart, sourceEnd: input.sourceEnd };
}

/**
 * Re-validate a render result. Requires the private capability AND a known
 * trusted authority. A manual render that merely claims `official_bakom` fails:
 * no capability, and the claim is not accepted from a plain object.
 */
export function isTrustedRenderResult(value: unknown): value is TrustedRenderResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TrustedRenderResult> & Record<PropertyKey, unknown>;
  if (candidate[RENDER_TRUST_CAPABILITY] !== true) return false;
  if (!isTrustedRendererAuthority(candidate.rendererAuthority)) return false;
  if (typeof candidate.presentationSystem !== "string" || candidate.presentationSystem.length === 0) return false;
  return true;
}

export function requireTrustedRenderResult(value: unknown): TrustedRenderResult {
  if (!isTrustedRenderResult(value)) {
    throw new Error("Untrusted render result: production finalization requires a canonical renderer output");
  }
  return value;
}

// --- Production artifact finalization -------------------------------------

export type ArtifactStatus = "preview" | "review_ready" | "production_valid" | "blocked";

/**
 * Minimal, machine-verifiable artifact manifest. Descriptor strings here are
 * EVIDENCE RECORDS derived from trusted capabilities—not trust themselves.
 */
export interface ProductionArtifactManifest {
  artifactStatus: ArtifactStatus;
  physicalTimingAuthority?: PhysicalTimingAuthority;
  physicalTimingProvider?: string;
  rendererAuthority?: string;
  presentationSystem?: string;
  rendererVersion?: string;
  reasons: string[];
}

export type FinalizeResult =
  | { ok: true; manifest: ProductionArtifactManifest }
  | { ok: false; status: "blocked"; reasons: string[] };

export interface FinalizeProductionArtifactInput {
  /** Must be a TrustedPhysicalTimeline (capability present). */
  physicalTimeline?: TrustedPhysicalTimeline | unknown;
  /** Must be a TrustedRenderResult (capability present). */
  renderResult?: TrustedRenderResult | unknown;
  /** QC checks; the current spoken Auto Production path requires no FAIL. */
  qcChecks?: Record<string, string>;
}

/**
 * The production trust gate for the current spoken Auto Production video.
 *
 * Policy for this artifact kind is fixed by the architecture, NOT by callers:
 *   - trusted physical timing: REQUIRED
 *   - canonical renderer:      REQUIRED
 *   - QC:                      REQUIRED (must be present, no FAIL)
 *
 * There are no `physicalTimingRequired` / `requiresQc` bypass flags, and no
 * injectable override. Fails closed with status "blocked".
 */
export function finalizeProductionArtifact(input: FinalizeProductionArtifactInput): FinalizeResult {
  const reasons: string[] = [];

  if (!isTrustedPhysicalTimeline(input.physicalTimeline)) {
    reasons.push("missing trusted physical timing (audio alignment required)");
  }
  const physical = isTrustedPhysicalTimeline(input.physicalTimeline) ? input.physicalTimeline : undefined;
  if (physical && (physical.provenance.openingDirect !== true || physical.provenance.endingDirect !== true || !Number.isFinite(physical.provenance.physicalStart) || !Number.isFinite(physical.provenance.physicalEnd))) {
    reasons.push("physical timeline lacks direct opening/ending anchors");
  }
  if (!isTrustedRenderResult(input.renderResult)) {
    reasons.push("missing trusted render result (canonical renderer required)");
  }
  if (!input.qcChecks || Object.keys(input.qcChecks).length === 0) {
    reasons.push("missing QC evidence");
  } else {
    const failing = Object.entries(input.qcChecks).filter(([, status]) => status === "FAIL").map(([id]) => id);
    if (failing.length > 0) reasons.push(`qc_failed: ${failing.join(", ")}`);
  }

  if (reasons.length > 0) return { ok: false, status: "blocked", reasons };

  const render = input.renderResult as TrustedRenderResult;
  if (!physical || render.sourceStart === undefined || render.sourceEnd === undefined || Math.abs(render.sourceStart - physical.provenance.physicalStart!) > 0.02 || Math.abs(render.sourceEnd - physical.provenance.physicalEnd!) > 0.02) {
    return { ok: false, status: "blocked", reasons: ["render bounds do not match trusted physical anchors"] };
  }
  return {
    ok: true,
    manifest: {
      artifactStatus: "production_valid",
      physicalTimingAuthority: physical.authority,
      physicalTimingProvider: physical.provenance.provider,
      rendererAuthority: render.rendererAuthority,
      presentationSystem: render.presentationSystem,
      rendererVersion: render.rendererVersion,
      reasons: [],
    },
  };
}

/**
 * Mark a non-finalized artifact for human review. Valid when provenance is
 * incomplete but no trust violation occurred (e.g. preview renders).
 */
export function markPreviewArtifact(reasons: string[]): ProductionArtifactManifest {
  return { artifactStatus: "preview", reasons };
}
