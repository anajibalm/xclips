import {
  ProductionBrief,
  ProductionBriefSchema,
  AccountPreset,
  resolveAccountPreset,
  EditPlan,
  EditorialSignal,
} from "@/lib/xclips/auto-production-types";
import { XclipsProject, XclipsTranscript, XclipsClip, Result } from "@/lib/xclips/types";

// ============================================================
// Auto Production Orchestrator — Slice 2
// ============================================================

// --- Dependency Injection --------------------------------------------------

/**
 * Wraps external service calls the orchestrator needs.
 * In production, wire from XclipsService; in tests, mock.
 */
export interface AutoProductionDeps {
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
   * We pass editorialAngle as topicPrompt and constrain to short duration (30-60s).
   * Returns XclipsClip[] with startSec/endSec/title.
   */
  discoverHighlights(
    projectId: string,
    options?: {
      topicPrompt?: string;
      hookFormula?: string;
      targetDuration?: "short" | "standard" | "long" | "extended";
      maxClipsCount?: number;
      transcriptId?: string;
    },
  ): Promise<Result<XclipsClip[]>>;
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

  // 5. Select statement (30-60s, guided by editorialAngle)
  const statement = await selectStatement(resolvedProject, validBrief.editorialAngle, deps);
  if (!statement.success) {
    return { success: false, error: statement.error, stage: "select_statement" };
  }
  const { candidate, signal: statementSignal } = statement.data;

  // 6. Produce headline from candidate title
  const headline = candidate.title || "Berita Terkini";
  const headlineSignal: EditorialSignal = {
    confidence: "strong",
    warnings: [],
  };

  // 7. B-roll: deferred to later slice — empty placements
  const brollSignal: EditorialSignal = {
    confidence: "strong",
    warnings: [],
  };

  // 8. Build EditPlan
  const editPlan: EditPlan = {
    statementStart: candidate.startSec,
    statementEnd: candidate.endSec,
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
  editorialAngle: string,
  deps: AutoProductionDeps,
): Promise<Result<{ candidate: XclipsClip; signal: EditorialSignal }>> {
  try {
    const highlightsResult = await deps.discoverHighlights(project.id, {
      topicPrompt: editorialAngle,
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

    // Validate duration constraint (30-60s)
    const duration = best.endSec - best.startSec;
    if (duration < STATEMENT_MIN_SEC || duration > STATEMENT_MAX_SEC) {
      return {
        success: false,
        error: `Selected statement duration ${duration.toFixed(1)}s outside target range ${STATEMENT_MIN_SEC}-${STATEMENT_MAX_SEC}s`,
      };
    }

    // Valid 30-60s statement selected → strong (no numeric calibration yet)
    const signal: EditorialSignal = { confidence: "strong", warnings: [] };

    const data: { candidate: typeof best; signal: EditorialSignal } = {
      candidate: best,
      signal,
    };
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Statement selection failed: ${msg}` };
  }
}
