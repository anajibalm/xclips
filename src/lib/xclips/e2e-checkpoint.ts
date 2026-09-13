import { createHash } from "node:crypto";
import type { RerenderJobContext } from "@/lib/xclips/auto-production-service";
import type { WordTimestamp, XclipsProject, XclipsTranscript } from "@/lib/xclips/types";
import { isValidIsoDate, resolveBriefSourceDate } from "@/lib/xclips/auto-production-helpers";
import { selectClipWords } from "@/lib/xclips/phrase-segmentation";
import {
  fallbackHeadlineFromTranscript,
  validateHeadlineGrounding,
} from "@/lib/xclips/transcript-chunker";

// ============================================================
// E2E Planning Checkpoint — runner support only.
// Production pipeline behavior is unchanged; the checkpoint lets an
// E2E runner resume render stages without repeating paid planning calls.
// No AI, no network, no secrets stored.
// ============================================================

export const PLANNING_CHECKPOINT_SCHEMA = "xclips.auto-production.planning.v1" as const;

export interface PlanningCheckpoint {
  schemaVersion: typeof PLANNING_CHECKPOINT_SCHEMA;
  sourcePath: string;
  projectId: string;
  transcriptId: string;
  transcriptHash: string;
  transcriptWordCount: number;
  provider: string;
  model: string;
  sourceMeta: XclipsProject["sourceMeta"] | null;
  brief: RerenderJobContext["brief"];
  preset: RerenderJobContext["preset"];
  editPlan: RerenderJobContext["editPlan"];
  sourceVideoPath: string;
  sourceWidth: number;
  sourceHeight: number;
  projectSourceMeta?: RerenderJobContext["projectSourceMeta"];
  contentType?: RerenderJobContext["contentType"];
}

/** Deterministic content hash over spoken words only (no identities, no keys). */
export function hashTranscriptWords(words: WordTimestamp[]): string {
  const canonical = words
    .map((w) => `${w.word}\u0000${w.start.toFixed(3)}\u0000${w.end.toFixed(3)}`)
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export interface CheckpointBuildInput {
  context: RerenderJobContext;
  projectId: string;
  transcriptId: string;
  provider: string;
  model: string;
}

/**
 * Build a checkpoint from a completed planning context. The full transcript
 * word array is NOT stored: render stages reload it from the DB by
 * transcriptId and verify transcriptHash, so words exist in exactly one
 * durable place (the database), never duplicated inside the checkpoint.
 */
export function buildPlanningCheckpoint(input: CheckpointBuildInput): PlanningCheckpoint {
  const { context } = input;
  return {
    schemaVersion: PLANNING_CHECKPOINT_SCHEMA,
    sourcePath: context.sourceVideoPath,
    projectId: input.projectId,
    transcriptId: input.transcriptId,
    transcriptHash: hashTranscriptWords(context.transcriptWords),
    transcriptWordCount: context.transcriptWords.length,
    provider: input.provider,
    model: input.model,
    sourceMeta: context.projectSourceMeta ?? null,
    brief: context.brief,
    preset: context.preset,
    editPlan: context.editPlan,
    sourceVideoPath: context.sourceVideoPath,
    sourceWidth: context.sourceWidth,
    sourceHeight: context.sourceHeight,
    ...(context.projectSourceMeta !== undefined ? { projectSourceMeta: context.projectSourceMeta } : {}),
    ...(context.contentType !== undefined ? { contentType: context.contentType } : {}),
  };
}

export interface CheckpointStore {
  getProject(projectId: string): XclipsProject | null | undefined;
  getTranscript(projectId: string, transcriptId: string): XclipsTranscript | null | undefined;
}

/**
 * Validate a checkpoint against persisted state and rebuild the exact
 * rerender context. Pure apart from the injected store reads; performs no
 * planning and no AI calls. Throws fail-closed on any mismatch.
 */
export function resolveResumeContext(
  checkpoint: unknown,
  store: CheckpointStore,
): RerenderJobContext {
  if (!checkpoint || typeof checkpoint !== "object") throw new Error("INVALID_PLANNING_CHECKPOINT");
  const cp = checkpoint as Partial<PlanningCheckpoint>;
  if (cp.schemaVersion !== PLANNING_CHECKPOINT_SCHEMA) throw new Error("INVALID_PLANNING_CHECKPOINT");
  if (!cp.sourcePath || !cp.projectId || !cp.transcriptId || !cp.transcriptHash) {
    throw new Error("INVALID_PLANNING_CHECKPOINT");
  }
  if (!cp.brief || !cp.preset || !cp.editPlan || !cp.sourceVideoPath) {
    throw new Error("INVALID_PLANNING_CHECKPOINT");
  }
  const project = store.getProject(cp.projectId);
  if (!project || project.sourcePath !== cp.sourcePath) throw new Error("PLANNING_SOURCE_MISMATCH");
  if (project.sourcePath !== cp.sourceVideoPath) throw new Error("PLANNING_PROJECT_MISMATCH");
  const transcript = store.getTranscript(cp.projectId, cp.transcriptId);
  if (!transcript || !Array.isArray(transcript.words) || transcript.words.length === 0) {
    throw new Error("PLANNING_TRANSCRIPT_MISMATCH");
  }
  if (hashTranscriptWords(transcript.words) !== cp.transcriptHash) {
    throw new Error("PLANNING_TRANSCRIPT_MISMATCH");
  }
  return {
    brief: cp.brief,
    preset: cp.preset,
    editPlan: cp.editPlan,
    transcriptWords: transcript.words,
    sourceVideoPath: cp.sourceVideoPath,
    sourceWidth: cp.sourceWidth ?? project.width ?? 1920,
    sourceHeight: cp.sourceHeight ?? project.height ?? 1080,
    ...(cp.projectSourceMeta !== undefined ? { projectSourceMeta: cp.projectSourceMeta } : {}),
    ...(cp.contentType !== undefined ? { contentType: cp.contentType } : {}),
  };
}

export type S6aArgs =
  | { mode: "fresh"; sourcePath: string; outDir: string }
  | {
      mode: "resume";
      checkpointPath: string;
      outDir: string;
      confirmContext: boolean;
      sourceDate?: string;
    }
  | { mode: "error"; error: string };

const DEFAULT_OUT_DIR = "artifacts/s6a-fresh-e2e";

const KNOWN_FLAGS = new Set(["--resume-planning", "--confirm-context", "--source-date"]);

/**
 * Parse E2E runner arguments. argv[0]/argv[1] (runtime + script) are never
 * treated as paths. Pure function — unit testable without processes or DB.
 *
 * Fresh:  bun scripts/s6a-e2e.ts <sourcePath> <outputDir>
 * Resume: bun scripts/s6a-e2e.ts --resume-planning <checkpointPath>
 *           [--confirm-context] [--source-date YYYY-MM-DD] <outputDir>
 *
 * --confirm-context and --source-date require resume mode. An invalid
 * --source-date fails here with INVALID_SOURCE_DATE, before any render.
 * Unknown --flags are rejected; no silent ignores.
 */
export function parseS6aArgs(argv: string[]): S6aArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { mode: "error", error: "usage: bun scripts/s6a-e2e.ts <sourcePath> <outputDir> | --resume-planning <checkpointPath> [--confirm-context] [--source-date YYYY-MM-DD] <outputDir>" };
  }
  let confirmContext = false;
  let sourceDate: string | undefined;
  const positionals: string[] = [];
  let resumePath: string | undefined;
  let resumeSeen = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--resume-planning") {
      resumeSeen = true;
      const next = args[i + 1];
      if (!next || next.startsWith("--")) return { mode: "error", error: "missing checkpoint path after --resume-planning" };
      resumePath = next;
      i++;
    } else if (arg === "--confirm-context") {
      confirmContext = true;
    } else if (arg === "--source-date") {
      const next = args[i + 1];
      if (!next || next.startsWith("--")) return { mode: "error", error: "INVALID_SOURCE_DATE: missing value after --source-date" };
      if (!isValidIsoDate(next)) return { mode: "error", error: `INVALID_SOURCE_DATE: "${next}" is not a valid ISO YYYY-MM-DD calendar date` };
      sourceDate = next.trim();
      i++;
    } else if (arg.startsWith("--")) {
      return { mode: "error", error: `unknown flag: ${arg}` };
    } else {
      positionals.push(arg);
    }
  }
  if (resumeSeen) {
    if (!resumePath) return { mode: "error", error: "missing checkpoint path after --resume-planning" };
    return {
      mode: "resume",
      checkpointPath: resumePath,
      outDir: positionals[0] ?? DEFAULT_OUT_DIR,
      confirmContext,
      ...(sourceDate !== undefined ? { sourceDate } : {}),
    };
  }
  if (confirmContext || sourceDate !== undefined) {
    return { mode: "error", error: "--confirm-context and --source-date require --resume-planning" };
  }
  const [sourcePath, outDir = DEFAULT_OUT_DIR] = positionals;
  if (!sourcePath) return { mode: "error", error: "missing source path" };
  return { mode: "fresh", sourcePath, outDir };
}

export interface ResumeOptions {
  /** Explicit human attestation for this run only; never persisted to the checkpoint. */
  confirmContext?: boolean;
  /** Explicit operator source date (validated ISO); overrides all fallbacks. */
  sourceDate?: string;
}

/**
 * Normalize a resumed planning context with current deterministic rules.
 * Pure apart from reading the supplied project/transcript values (no DB
 * access inside, no AI, no network):
 * - confirmContext only ever sets brief.contextIntegrityConfirmed = true.
 * - sourceDate: explicit operator date wins (validated), else platform
 *   upload date with platform_upload provenance, else missing.
 * - headline: revalidated against transcript words; ungrounded headlines
 *   take a validated extractive fallback, otherwise the old headline stays
 *   with a review signal.
 * Never writes back to the checkpoint file.
 */
export function applyResumeOptions(
  context: RerenderJobContext,
  project: Pick<XclipsProject, "sourceMeta">,
  transcriptWords: WordTimestamp[],
  opts: ResumeOptions = {},
): RerenderJobContext {
  const brief = { ...context.brief };
  if (opts.confirmContext === true) {
    brief.contextIntegrityConfirmed = true;
  }
  if (opts.sourceDate !== undefined) {
    if (!isValidIsoDate(opts.sourceDate)) throw new Error(`INVALID_SOURCE_DATE: "${opts.sourceDate}"`);
    brief.sourceDate = opts.sourceDate.trim();
    brief.sourceDateProvenance = "operator";
  } else {
    const resolved = resolveBriefSourceDate(
      brief.sourceDate,
      project.sourceMeta?.uploadDate ?? context.projectSourceMeta?.uploadDate,
    );
    brief.sourceDate = resolved.date;
    brief.sourceDateProvenance = resolved.provenance;
  }

  let editPlan = context.editPlan;
  const selectedText = selectClipWords(transcriptWords, editPlan.statementStart, editPlan.statementEnd)
    .map((w) => w.word)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (selectedText) {
    const check = validateHeadlineGrounding(editPlan.headline, selectedText);
    if (check.grounded) {
      // Grounded headline: untouched (signal included).
    } else {
      const extractive = fallbackHeadlineFromTranscript(selectedText);
      const recheck = extractive ? validateHeadlineGrounding(extractive, selectedText) : { grounded: false };
      if (extractive && recheck.grounded) {
        editPlan = {
          ...editPlan,
          headline: extractive,
          headlineSignal: {
            confidence: "strong",
            warnings: [
              `AI headline ungrounded (${check.suspicious.join(", ")}) — deterministic extractive fallback from selected transcript used`,
            ],
          },
        };
      } else if (editPlan.headlineSignal.confidence !== "review" && editPlan.headlineSignal.confidence !== "low") {
        editPlan = {
          ...editPlan,
          headlineSignal: {
            confidence: "review",
            warnings: [
              ...editPlan.headlineSignal.warnings,
              `Headline ungrounded (${check.suspicious.join(", ")}) with no valid extractive fallback — human review required`,
            ],
          },
        };
      }
    }
  }

  return { ...context, brief, editPlan, transcriptWords };
}
