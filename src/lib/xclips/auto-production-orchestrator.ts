import {
  ProductionBrief,
  ProductionBriefSchema,
  AccountPreset,
  resolveAccountPreset,
  EditPlan,
  EditorialSignal,
} from "@/lib/xclips/auto-production-types";
import { XclipsProject, XclipsTranscript, XclipsClip, Result } from "@/lib/xclips/types";
import { findStartBoundary, selectClipWords } from "@/lib/xclips/auto-production-renderer";
import {
  validateHeadlineGrounding,
  fallbackHeadlineFromTranscript,
} from "@/lib/xclips/transcript-chunker";

// ============================================================
// Auto Production Orchestrator — Slice 2
// ============================================================

// --- Dependency Injection --------------------------------------------------

/**
 * Wraps external service calls the orchestrator needs.
 * In production, wire from XclipsService; in tests, mock.
 */
export interface AutoProductionDeps {
  /**
   * Resolve an already-persisted project for an exact source identity.
   * Lets Generate/Regenerate reuse the same source/project + transcript
   * instead of minting a duplicate project per run. Optional so existing
   * callers/mocks without it keep the legacy ingest-always behavior.
   * Returns null when no reusable project exists (callers fall through
   * to ingest). Never throws — failures resolve as null.
   */
  findExistingProjectBySourcePath?(sourcePath: string): Promise<Result<XclipsProject | null>>;
  /** Ingest a local file → project */
  ingestLocalFile(sourcePath: string, customName?: string): Promise<Result<XclipsProject>>;
  /** Ingest a YouTube/URL → project */
  ingestYouTubeUrl(
    url: string,
    options?: { quality?: string; customName?: string; downloadSubtitles?: boolean },
    onProgress?: (p: unknown) => void,
  ): Promise<Result<XclipsProject>>;
  /** Get an existing transcript for a project (e.g. YouTube CC), returns null if none */
  getExistingTranscript(projectId: string): Promise<Result<XclipsTranscript | null>>;
  /** Transcribe an existing project (returns existing transcript if valid) */
  transcribeProject(
    projectId: string,
    options?: { model?: string; apiKey?: string },
  ): Promise<Result<XclipsTranscript>>;
  /**
   * Discover highlights from a project's transcript.
   * We pass editorialAngle as topicPrompt, editorialFunction as planning
   * context (Bakom content category — never conflated with hookFormula),
   * and constrain to short duration (30-60s).
   * Returns XclipsClip[] with startSec/endSec/title.
   */
  discoverHighlights(
    projectId: string,
    options?: {
      topicPrompt?: string;
      editorialFunction?: string;
      hookFormula?: string;
      targetDuration?: "short" | "standard" | "long" | "extended";
      maxClipsCount?: number;
      transcriptId?: string;
    },
  ): Promise<Result<XclipsClip[]>>;
  /**
   * S1.3: ONE dedicated headline call over the FINAL guarded selected
   * transcript. Implementations must not receive full-transcript context.
   */
  generateHeadline(
    input: {
      selectedText: string;
      speaker?: string;
      publisher?: string;
    },
  ): Promise<Result<{ headline: string }>>;
}

// --- Result Types ---------------------------------------------------------

export type PlanningResult =
  | PlanningSuccess
  | PlanningFailure;

interface PlanningSuccess {
  success: true;
  brief: ProductionBrief;
  preset: AccountPreset;
  project: XclipsProject;
  transcript: XclipsTranscript;
  editPlan: EditPlan;
}

interface PlanningFailure {
  success: false;
  error: string;
  stage: PlanningStage;
}

export type PlanningStage =
  | "validate_brief"
  | "resolve_preset"
  | "prepare_source"
  | "transcribe"
  | "select_statement"
  | "produce_plan";

// --- Constants ------------------------------------------------------------

const STATEMENT_MIN_SEC = 30;
const STATEMENT_MAX_SEC = 60;

// --- Orchestrator Entry Point ---------------------------------------------

export async function runAutoProductionPlanning(
  brief: ProductionBrief,
  deps: AutoProductionDeps,
): Promise<PlanningResult> {
  // 1. Validate brief
  const briefResult = ProductionBriefSchema.safeParse(brief);
  if (!briefResult.success) {
    const msg = briefResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { success: false, error: `Invalid brief: ${msg}`, stage: "validate_brief" };
  }
  const validBrief = briefResult.data;

  // 2. Resolve account preset
  const preset = resolveAccountPreset(validBrief.accountPresetId);
  if (!preset) {
    return {
      success: false,
      error: `Unknown account preset: ${validBrief.accountPresetId}`,
      stage: "resolve_preset",
    };
  }

  // 3. Prepare source
  const project = await prepareSource(validBrief, deps);
  if (!project.success) {
    return { success: false, error: project.error, stage: "prepare_source" };
  }
  const resolvedProject = project.data;

  // 4. Obtain transcript
  const transcript = await obtainTranscript(resolvedProject, deps);
  if (!transcript.success) {
    return { success: false, error: transcript.error, stage: "transcribe" };
  }
  const resolvedTranscript = transcript.data;

  // 5. Select statement (30-60s, guided by editorialAngle + editorialFunction)
  const statement = await selectStatement(resolvedProject, resolvedTranscript, validBrief.editorialAngle, validBrief.editorialFunction, deps);
  if (!statement.success) {
    return { success: false, error: statement.error, stage: "select_statement" };
  }
  const { candidate, signal: statementSignal } = statement.data;

  // 6. Dedicated grounded headline (S1.3): generated AFTER guards finalize
  //    bounds, from the FINAL selected transcript only + verified identity.
  const { headline, headlineSignal } = await produceGroundedHeadline(
    resolvedProject,
    resolvedTranscript,
    candidate.startSec,
    candidate.endSec,
    deps,
  );
  // CC/YouTube timings are alignment hints, not physical cut truth. Keep
  // frozen S1 clip continuous until audio-derived alignment supplies cuts.
  const keepIntervals = [{
    start: 0,
    end: candidate.endSec - candidate.startSec,
    duration: candidate.endSec - candidate.startSec,
  }];

  // 7. B-roll: deferred to later slice — empty placements
  const brollSignal: EditorialSignal = {
    confidence: "strong",
    warnings: [],
  };

  // 8. Build EditPlan
  const editPlan: EditPlan = {
    statementStart: candidate.startSec,
    statementEnd: candidate.endSec,
    keepIntervals,
    headline,
    brollPlacements: [],
    thumbnailSourceFrame: undefined,
    statementSignal,
    brollSignal,
    headlineSignal,
  };

  return {
    success: true,
    brief: validBrief,
    preset,
    project: resolvedProject,
    transcript: resolvedTranscript,
    editPlan,
  };
}

// --- Internal Helpers -----------------------------------------------------

async function prepareSource(
  brief: ProductionBrief,
  deps: AutoProductionDeps,
): Promise<Result<XclipsProject>> {
  try {
    // Reuse the persisted source/project when the exact source identity
    // already exists (keeps project + transcript stable across
    // Generate/Regenerate). Falls through to ingest on miss/error.
    if (deps.findExistingProjectBySourcePath) {
      try {
        const existing = await deps.findExistingProjectBySourcePath(brief.source.sourcePath);
        if (existing.success && existing.data) {
          return { success: true, data: existing.data };
        }
      } catch {
        // fail open to ingest below
      }
    }
    if (brief.source.sourceType === "local") {
      return await deps.ingestLocalFile(brief.source.sourcePath, brief.sourceName);
    } else {
      return await deps.ingestYouTubeUrl(brief.source.sourcePath, {
        customName: brief.sourceName,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Source preparation failed: ${msg}` };
  }
}

async function obtainTranscript(
  project: XclipsProject,
  deps: AutoProductionDeps,
): Promise<Result<XclipsTranscript>> {
  try {
    // First check for existing transcript (e.g. YouTube CC subtitles)
    const existing = await deps.getExistingTranscript(project.id);
    if (existing.success && existing.data) {
      if (existing.data.words && existing.data.words.length > 0) {
        return existing as Result<XclipsTranscript>;
      }
    }
    // Fall back to AI transcription
    const result = await deps.transcribeProject(project.id);
    if (!result.success) {
      return { success: false, error: result.error || "Transcription failed" };
    }
    if (!result.data || !result.data.words || result.data.words.length === 0) {
      return { success: false, error: "Transcription produced no usable words" };
    }
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Transcription failed: ${msg}` };
  }
}

async function selectStatement(
  project: XclipsProject,
  transcript: XclipsTranscript,
  editorialAngle: string,
  editorialFunction: string,
  deps: AutoProductionDeps,
): Promise<Result<{ candidate: XclipsClip; signal: EditorialSignal }>> {
  try {
    const highlightsResult = await deps.discoverHighlights(project.id, {
      topicPrompt: editorialAngle,
      editorialFunction,
      targetDuration: "short", // 30-60s
      maxClipsCount: 3,
    });

    if (!highlightsResult.success) {
      return {
        success: false,
        error: highlightsResult.error || "Statement selection failed",
      };
    }

    const highlights = highlightsResult.data || [];
    if (highlights.length === 0) {
      return {
        success: false,
        error: "No suitable statement found matching the editorial angle",
      };
    }

    // Pick the highest-scoring candidate
    const best = highlights.reduce((prev, curr) =>
      (curr.viralScore || 0) > (prev.viralScore || 0) ? curr : prev,
    );

    // Duration policy (minimum side is a review threshold, not a hard reject):
    // - above the 60s ceiling → technical failure (unchanged ceiling)
    // - zero/negative span → malformed bounds, technical failure (not a policy bound)
    // - below the 30s floor but positive → semantically complete short
    //   statement still proceeds; flagged for human review (PRD FR-6).
    //   No filler/padding is ever added to reach a target.
    const closure = findSemanticEndClosure(best.endSec, transcript.words, best.startSec);
    const adjustedEnd = closure.endSec;
    const guardedStart = findStartBoundary(transcript.words, best.startSec);
    const duration = adjustedEnd - guardedStart;
    if (duration > STATEMENT_MAX_SEC) {
      return {
        success: false,
        error: `Selected statement duration ${duration.toFixed(1)}s outside target range ${STATEMENT_MIN_SEC}-${STATEMENT_MAX_SEC}s`,
      };
    }
    if (!(duration > 0)) {
      return {
        success: false,
        error: `Selected statement has malformed bounds (startSec=${best.startSec}, endSec=${best.endSec})`,
      };
    }

    // Valid 30-60s statement selected → strong (no numeric calibration yet).
    // Sub-30s positive statement → review signal with machine-readable cause.
    const signal: EditorialSignal =
      duration < STATEMENT_MIN_SEC
        ? {
            confidence: "review",
            warnings: [
              `Statement duration ${duration.toFixed(1)}s below ${STATEMENT_MIN_SEC}s review threshold — short statement kept as-is for human review, no filler added`,
            ],
          }
        : {
            confidence: closure.warning ? "review" : "strong",
            warnings: closure.warning ? [closure.warning] : [],
          };

    const data: { candidate: typeof best; signal: EditorialSignal } = {
      candidate: { ...best, startSec: guardedStart, endSec: adjustedEnd },
      signal,
    };
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Statement selection failed: ${msg}` };
  }
}

/**
 * S1.3: dedicated grounded headline step. Runs AFTER deterministic guards
 * finalize bounds. Slices words strictly inside [startSec, endSec] and asks
 * for ONE headline over that slice only (+ verified publisher label).
 * Never fails the video: AI failure falls back to a deterministic
 * transcript fragment with a review signal; empty selection routes to
 * NEEDS_REVIEW via the headline signal (never invented content).
 */
async function produceGroundedHeadline(
  project: XclipsProject,
  transcript: XclipsTranscript,
  startSec: number,
  endSec: number,
  deps: AutoProductionDeps,
): Promise<{ headline: string; headlineSignal: EditorialSignal }> {
  const selectedWords = selectClipWords(transcript.words, startSec, endSec);
  const selectedText = selectedWords
    .map((w) => w.word)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const publisher =
    project.sourceMeta?.channel?.trim() ||
    project.sourceMeta?.uploader?.trim() ||
    undefined;

  if (!selectedText) {
    return {
      headline: "",
      headlineSignal: {
        confidence: "review",
        warnings: ["Empty final selected transcript — headline unresolved, human review required"],
      },
    };
  }

  let generated: Result<{ headline: string }>;
  try {
    generated = await deps.generateHeadline({ selectedText, publisher });
  } catch {
    generated = { success: false, error: "Headline generation failed" };
  }
  if (generated.success && generated.data.headline.trim()) {
    const headline = generated.data.headline.trim();
    const check = validateHeadlineGrounding(headline, selectedText);
    if (check.grounded) {
      return { headline, headlineSignal: { confidence: "strong", warnings: [] } };
    }
    return {
      headline,
      headlineSignal: {
        confidence: "review",
        warnings: [
          `Headline contains words absent from the selected clip: ${check.suspicious.join(", ")} — human review required`,
        ],
      },
    };
  }

  const fallback = fallbackHeadlineFromTranscript(selectedText);
  if (fallback) {
    return {
      headline: fallback,
      headlineSignal: {
        confidence: "review",
        warnings: ["Headline generation failed — deterministic transcript fallback used, human review required"],
      },
    };
  }
  return {
    headline: "",
    headlineSignal: {
      confidence: "review",
      warnings: ["Headline generation failed with no safe fallback — human review required"],
    },
  };
}

function findSemanticEndClosure(
  selectedEndSec: number,
  words: XclipsTranscript["words"],
  startSec: number,
): { endSec: number; warning?: string } {
  const closure = words
    .filter((word) => word.end > selectedEndSec && word.end - startSec <= STATEMENT_MAX_SEC)
    .find((word) => /[.!?]$/.test(word.word.trim()));
  if (closure) return { endSec: closure.end };

  const finalWord = words.find((word) => word.end >= selectedEndSec);
  if (finalWord && /[.!?]$/.test(finalWord.word.trim())) return { endSec: finalWord.end };
  if (finalWord) {
    return {
      endSec: selectedEndSec,
      warning: "Statement endpoint has no verified sentence closure within the 60s ceiling — human review required",
    };
  }
  return { endSec: selectedEndSec };
}
