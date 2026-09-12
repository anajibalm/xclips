import {
	type CoverResult,
	generateAutoProductionCover,
} from "@/lib/xclips/auto-production-cover";
import {
	type AutoProductionDeps,
	runAutoProductionPlanning,
} from "@/lib/xclips/auto-production-orchestrator";
import {
	type QcResult,
	runAutoProductionQc,
} from "@/lib/xclips/auto-production-qc";
import {
	type RenderAutoProductionInput,
	type RenderAutoProductionResult,
	type RenderAutoProductionFailure,
	renderAutoProduction,
} from "@/lib/xclips/auto-production-renderer";
import type {
	AccountPreset,
	EditPlan,
	ProductionBrief,
} from "@/lib/xclips/auto-production-types";
import type { Result, WordTimestamp } from "@/lib/xclips/types";
import type { ContentType } from "@/lib/xclips/auto-production-bakom-layout";
import {
	finalizeProductionArtifact,
	isTrustedPhysicalTimeline,
	isTrustedRenderResult,
	recordCanonicalBakomRender,
	runPhysicalAlignment,
	type ProductionArtifactManifest,
} from "@/lib/xclips/production-trust";
import { renderOfficialBakomSequential } from "@/lib/xclips/official-bakom-renderer";
import { generateGenerativeThumbnail, type GenerativeThumbnailInput, type GenerativeThumbnailResult } from "@/lib/xclips/generative-thumbnail";
import { buildPublishReviewPackage, type PublishPackageInput } from "@/lib/xclips/publish-package-builder";
import * as path from "path";

// Re-export pure helper from client-safe module
export { detectSourceType } from "@/lib/xclips/auto-production-helpers";
import { resolveSourceCreditName } from "@/lib/xclips/auto-production-helpers";

export type OfficialFramingMode = "FIELD_FIT_BG" | "TALKING_HEAD_SAFE";

export interface S5ThumbnailConfig {
	referenceImages: string[];
	generatorRepo?: string;
	generatorCommit?: string;
	source: PublishPackageInput["source"];
	materialSources: PublishPackageInput["materialSources"];
	framingPolicy: PublishPackageInput["framingPolicy"];
	modules: PublishPackageInput["modules"];
	reviewFlags: PublishPackageInput["reviewFlags"];
	publication: PublishPackageInput["publication"];
}

/** MVP landscape news sources keep full-frame context; talking-head crop remains experimental. */
export function resolveOfficialFramingMode(
	sourceVideoPath: string,
	contentType?: ContentType,
): OfficialFramingMode {
	void sourceVideoPath;
	void contentType;
	return "FIELD_FIT_BG";
}

function normalizeStatementToken(value: string): string {
	return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Deterministic canonical form of statement-overlapping transcript words.
 * YouTube CC word timings are non-monotonic (overlapping rollup cues), so
 * anchor selection cannot trust raw transcript order. This stable-sorts by
 * (start, end) — transcript order wins exact ties — and drops duplicate
 * rollup entries: same normalized text with overlapping time. No word
 * blacklists, no fuzzy rewriting; distinct overlapping words are retained.
 */
export function canonicalizeStatementWords(words: WordTimestamp[]): WordTimestamp[] {
	const sorted = [...words].sort((a, b) => a.start - b.start || a.end - b.end);
	const kept: WordTimestamp[] = [];
	for (const word of sorted) {
		const token = normalizeStatementToken(word.word);
		if (token) {
			const duplicate = kept.some(
				(keptWord) =>
					normalizeStatementToken(keptWord.word) === token &&
					keptWord.start < word.end &&
					word.start < keptWord.end,
			);
			if (duplicate) continue;
		}
		kept.push(word);
	}
	return kept;
}

/**
 * Physical anchor targets must come from the selected editorial statement,
 * never from whole-transcript edges. Selects transcript words overlapping
 * [statementStart, statementEnd), canonicalizes them (chronological,
 * deduped), and returns the first/last lexical words.
 */
export function selectStatementEdgePhrases(
	transcriptWords: WordTimestamp[],
	statementStart: number,
	statementEnd: number,
	edgeWords = 4,
): { openingPhrase: string[]; endingPhrase: string[]; selectedCount: number } {
	const selected = canonicalizeStatementWords(
		transcriptWords.filter((word) => word.end > statementStart && word.start < statementEnd),
	);
	const lexical = selected.map((word) => word.word).filter((word) => word.trim().length > 0);
	const count = Math.max(1, Math.min(edgeWords, lexical.length));
	return {
		openingPhrase: lexical.slice(0, count),
		endingPhrase: lexical.slice(-count),
		selectedCount: selected.length,
	};
}

// ============================================================
// Auto Production Service — Slice 5 (Pipeline Glue)
// ============================================================

// --- Types ----------------------------------------------------------------

export type AutoProductionStage =
	| "preparing_source"
	| "transcript_ready"
	| "selecting_statement"
	| "preparing_graphics"
	| "rendering"
	| "running_qc"
	| "trust_finalization"
	| "thumbnail_generation"
	| "publish_package";

export type AutoProductionJobResult =
	| AutoProductionJobReady
	| AutoProductionJobNeedsReview
	| AutoProductionJobFailed;

interface AutoProductionJobReady {
	status: "READY";
	bundle: AutoProductionJobBundle;
}

interface AutoProductionJobNeedsReview {
	status: "NEEDS_REVIEW";
	bundle: AutoProductionJobBundle;
	reasons: string[];
}

interface AutoProductionJobFailed {
	status: "FAILED";
	stage: AutoProductionStage | "cover_generation" | "qc" | "trust_finalization";
	error: string;
}

/** All artifacts from a successful job needed for deterministic rerender. */
export interface AutoProductionJobBundle {
	videoPath: string;
	coverPath: string;
	publishPackagePath?: string;
	qc: QcResult;
	editPlan: EditPlan;
	preset: AccountPreset;
	/** Planning context preserved for Render Again (no re-ingest/transcribe). */
	rerenderContext: RerenderJobContext;
}

async function renderOfficialProduction(input: RenderAutoProductionInput, options?: { outputDir?: string }): Promise<RenderAutoProductionResult | RenderAutoProductionFailure> {
	try {
		const duration = input.editPlan.statementEnd - input.editPlan.statementStart;
		const cues: Array<{ start: number; end: number; text: string; emphasis?: string }> = [];
		let current: WordTimestamp[] = [];
		for (const word of input.transcriptWords) {
			const start = word.start - input.editPlan.statementStart;
			const end = word.end - input.editPlan.statementStart;
			if (end <= 0 || start >= duration) continue;
      const candidate = [...current, word].map((item) => item.word).join(" ");
      if (current.length > 0 && candidate.length > 64) {
        const cueStart = Math.max(0, current[0].start - input.editPlan.statementStart);
        const cueEnd = Math.min(duration, current[current.length - 1].end - input.editPlan.statementStart);
        if (cueEnd > cueStart) cues.push({ start: cueStart, end: cueEnd, text: current.map((item) => item.word).join(" ") });
        current = [];
      }
      current.push(word);
    }
    if (current.length > 0) {
      const cueStart = Math.max(0, current[0].start - input.editPlan.statementStart);
      const cueEnd = Math.min(duration, current[current.length - 1].end - input.editPlan.statementStart);
      if (cueEnd > cueStart) cues.push({ start: cueStart, end: cueEnd, text: current.map((item) => item.word).join(" ") });
    }
		const outputDir = options?.outputDir ?? path.resolve(process.cwd(), "output", "xclips", "auto-production");
		const outputPath = path.join(outputDir, `official_${Date.now()}.mp4`);
    const framingMode = resolveOfficialFramingMode(input.sourceVideoPath, input.contentType);
    const trusted = await renderOfficialBakomSequential({ sourceVideoPath: input.sourceVideoPath, sourceStart: input.editPlan.statementStart, sourceEnd: input.editPlan.statementEnd, headline: input.editPlan.headline, cues, credit: `${input.brief.sourceName} · ${input.brief.accountHandle}`, outputPath, framingMode });
		const trustedRenderResult = recordCanonicalBakomRender(trusted);
		if (!trustedRenderResult) throw new Error("Canonical BAKOM render trust recording failed");
		return { success: true, outputPath, durationSec: trusted.durationSec, width: trusted.width, height: trusted.height, fps: trusted.fps, trustedRenderResult };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Official BAKOM render failed", stage: "ffmpeg_render" };
	}
}

/**
 * Minimum context needed to rerender without re-running planning.
 * Stored in the job bundle so Render Again can reuse it deterministically.
 */
export interface RerenderJobContext {
	brief: ProductionBrief;
	preset: AccountPreset;
	editPlan: EditPlan;
	transcriptWords: WordTimestamp[];
	sourceVideoPath: string;
	sourceWidth: number;
	sourceHeight: number;
	contentType?: ContentType;
}

export interface RunAutoProductionJobInput {
	brief: ProductionBrief;
	deps: AutoProductionDeps;
	outputDir?: string;
	onProgress?: (stage: AutoProductionStage) => void;
	_overrides?: {
		render?: (
			input: RenderAutoProductionInput,
			opts?: { outputDir?: string },
		) => Promise<RenderAutoProductionResult | RenderAutoProductionFailure>;
		cover?: (
			input: {
				sourceVideoPath: string;
				sourceWidth: number;
				sourceHeight: number;
				editPlan: EditPlan;
				preset: AccountPreset;
				contentType?: ContentType;
			},
			outputDir: string,
		) => Promise<CoverResult>;
		qc?: (input: {
			outputPath: string;
			brief: ProductionBrief;
			preset: AccountPreset;
			editPlan: EditPlan;
			renderWidth: number;
			renderHeight: number;
			renderFps: number;
			renderDurationSec: number;
			transcriptWords?: WordTimestamp[];
		}		) => Promise<QcResult>;
	generateThumbnail?: (input: GenerativeThumbnailInput) => ReturnType<typeof generateGenerativeThumbnail>;
		buildPackage?: (input: PublishPackageInput) => ReturnType<typeof buildPublishReviewPackage>;
		finalizeTrust?: typeof finalizeProductionArtifact;
	};
	s5?: S5ThumbnailConfig;
}

// --- Entry Point: Full Job (Plan → Render → Cover → QC) -------------------

export async function runAutoProductionJob(
	input: RunAutoProductionJobInput,
): Promise<AutoProductionJobResult> {
	const { brief, deps, outputDir, onProgress, _overrides } = input;

	const doRender = _overrides?.render ?? renderOfficialProduction;
	const doCover = _overrides?.cover ?? generateAutoProductionCover;
	const doQc = _overrides?.qc ?? runAutoProductionQc;

	// 1. Planning (includes ingest, transcribe, discover highlights)
	onProgress?.("preparing_source");
	const planning = await runAutoProductionPlanning(brief, deps);
	if (!planning.success) {
		return mapPlanningFailure(planning);
	}

	onProgress?.("transcript_ready");
	onProgress?.("selecting_statement");

	const { preset, project, transcript, editPlan } = planning;

	// S1.2: resolve publisher-level source credit upstream of rendering.
	// Persisted channel/uploader metadata wins over a video-title sourceName;
	// the footer resolver downstream only measures/fits/truncates.
	const creditedBrief: ProductionBrief = {
		...planning.brief,
		sourceName: resolveSourceCreditName(project.sourceMeta, planning.brief.sourceName),
	};

	// Build rerender context from planning result
  const rerenderContext: RerenderJobContext = {
		brief: creditedBrief,
		preset,
		editPlan,
		transcriptWords: transcript.words,
		sourceVideoPath: project.sourcePath,
    sourceWidth: project.width ?? 1920,
    sourceHeight: project.height ?? 1080,
  };

	// 2. Render → Cover → QC (shared with rerender path)
	return executeRenderCoverQc({
		rerenderContext,
		outputDir,
		onProgress,
		doRender,
		doCover,
		 doQc,
		s5: input.s5,
		generateThumbnail: _overrides?.generateThumbnail,
		buildPackage: _overrides?.buildPackage,
		finalizeTrust: _overrides?.finalizeTrust,
	});
}

// --- Entry Point: Rerender Only (No Planning) -----------------------------

export interface RerenderAutoProductionJobInput {
	context: RerenderJobContext;
	outputDir?: string;
	onProgress?: (stage: AutoProductionStage) => void;
	_overrides?: RunAutoProductionJobInput["_overrides"];
	s5?: S5ThumbnailConfig;
}

/**
 * Deterministic rerender using preserved planning artifacts.
 * Performs only: render → cover → QC.
 * NO ingest, NO transcription, NO AI highlight discovery.
 */
export async function rerenderAutoProductionJob(
	input: RerenderAutoProductionJobInput,
): Promise<AutoProductionJobResult> {
	const { context, outputDir, onProgress, _overrides } = input;

	const doRender = _overrides?.render ?? renderOfficialProduction;
	const doCover = _overrides?.cover ?? generateAutoProductionCover;
	const doQc = _overrides?.qc ?? runAutoProductionQc;

	return executeRenderCoverQc({
		rerenderContext: context,
		outputDir,
		onProgress,
		doRender,
		doCover,
		doQc,
		s5: input.s5,
		generateThumbnail: _overrides?.generateThumbnail,
		buildPackage: _overrides?.buildPackage,
		finalizeTrust: _overrides?.finalizeTrust,
	});
}

// --- Shared Render → Cover → QC Pipeline ----------------------------------

interface ExecuteInput {
	rerenderContext: RerenderJobContext;
	outputDir?: string;
	onProgress?: (stage: AutoProductionStage) => void;
	doRender: (
		input: RenderAutoProductionInput,
		opts?: { outputDir?: string },
	) => Promise<RenderAutoProductionResult | RenderAutoProductionFailure>;
	doCover: (
		input: {
			sourceVideoPath: string;
			sourceWidth: number;
			sourceHeight: number;
			contentType?: ContentType;
			editPlan: EditPlan;
			preset: AccountPreset;
		},
		outputDir: string,
	) => Promise<CoverResult>;
	doQc: (input: {
		outputPath: string;
		brief: ProductionBrief;
		preset: AccountPreset;
		editPlan: EditPlan;
		renderWidth: number;
		renderHeight: number;
		renderFps: number;
		renderDurationSec: number;
		transcriptWords?: WordTimestamp[];
	}) => Promise<QcResult>;
	s5?: S5ThumbnailConfig;
	generateThumbnail?: (input: GenerativeThumbnailInput) => Promise<Result<GenerativeThumbnailResult>>;
	buildPackage?: (input: PublishPackageInput) => ReturnType<typeof buildPublishReviewPackage>;
	finalizeTrust?: typeof finalizeProductionArtifact;
}

async function executeRenderCoverQc(
	input: ExecuteInput,
): Promise<AutoProductionJobResult> {
	const { rerenderContext, outputDir, onProgress, doRender, doCover, doQc, s5, finalizeTrust } =
		input;
	const { brief, preset, editPlan, transcriptWords, sourceVideoPath, sourceWidth, sourceHeight, contentType } =
		rerenderContext;
	// Mirror the renderer's default so cover never receives an empty dir
	// when callers (e.g. Hono routes) omit outputDir.
	const coverOutputDir =
		outputDir ?? path.resolve(process.cwd(), "output", "xclips", "auto-production");

	// 2. Rendering
	onProgress?.("preparing_graphics");
	onProgress?.("rendering");

	const renderInput: RenderAutoProductionInput = {
		brief,
		preset,
		editPlan,
		transcriptWords,
		sourceVideoPath,
		sourceWidth,
		sourceHeight,
		contentType,
	};

	const renderResult = await doRender(renderInput, { outputDir });
	if (!renderResult.success) {
		return {
			status: "FAILED",
			stage: mapRenderStage(renderResult.stage),
			error: renderResult.error,
		};
	}

	// 3. Cover generation
	const coverResult = await doCover(
		{
			sourceVideoPath,
			sourceWidth,
			 sourceHeight,
			 contentType,
			 editPlan,
			 preset,
		},
		coverOutputDir,
	);
	if (!coverResult.success) {
		return {
			status: "FAILED",
			stage: "cover_generation",
			error: coverResult.error,
		};
	}

	// 4. QC
	onProgress?.("running_qc");
	const qc = await doQc({
		outputPath: renderResult.outputPath,
		brief,
		preset,
		editPlan,
		renderWidth: renderResult.width,
		renderHeight: renderResult.height,
		renderFps: renderResult.fps,
			renderDurationSec: renderResult.durationSec,
		transcriptWords,
	});

	const bundle: AutoProductionJobBundle = {
		videoPath: renderResult.outputPath,
		coverPath: coverResult.coverPath,
		qc,
		editPlan,
		preset,
		rerenderContext,
	};

	if (qc.verdict === "FAILED") {
		return {
			status: "FAILED",
			stage: "qc",
			error: qc.checks
				.filter((c) => c.status === "FAIL")
				.map((c) => c.message)
				.join("; "),
		};
	}

	if (qc.verdict === "NEEDS_REVIEW") {
		const reasons = qc.checks
			.filter((c) => c.status === "REVIEW")
			.map((c) => c.message);
		return { status: "NEEDS_REVIEW", bundle, reasons };
	}

	// Production trust gate (ARCH.1 / ARCH.1R §10). READY for a spoken Auto
	// Production video requires trusted physical timing, a canonical renderer
	// result, and passing QC. Policy is fixed here, never caller-controlled.
	// The current render path does not produce a canonical official
	// presentation render result, so this FAILS CLOSED rather than declaring a
	// scratch-style output production-valid.
	const statementAnchors = selectStatementEdgePhrases(
		transcriptWords,
		editPlan.statementStart,
		editPlan.statementEnd,
		4,
	);
	const physical = await runPhysicalAlignment({
		sourceVideoPath,
		searchStartSec: Math.max(0, editPlan.statementStart - 5),
		searchEndSec: editPlan.statementEnd + 5,
		workDir: path.join(coverOutputDir, "physical-alignment"),
		openingPhrase: statementAnchors.openingPhrase,
		endingPhrase: statementAnchors.endingPhrase,
	});
	onProgress?.("trust_finalization");
	const manifest = (finalizeTrust ?? finalizeProductionArtifact)({
		physicalTimeline: physical.ok ? physical.timeline : undefined,
		renderResult: renderResult.trustedRenderResult,
		qcChecks: Object.fromEntries(qc.checks.map((check) => [check.id, check.status])),
	});
	const trustManifest = manifest.ok ? manifest.manifest : { artifactStatus: "blocked" as const, reasons: manifest.reasons };
	if (trustManifest.artifactStatus !== "production_valid") {
		return {
			status: "FAILED",
			stage: "trust_finalization",
			error: `Production trust gate blocked: ${trustManifest.reasons.join("; ")}`,
		};
	}

	if (s5) {
		onProgress?.("thumbnail_generation");
		const thumbnailResult = await (input.generateThumbnail ?? generateGenerativeThumbnail)({
			sourceVideoPath,
			sourceStillTimestamp: editPlan.thumbnailSourceFrame ?? editPlan.statementStart,
			title: editPlan.headline,
			sourceCredit: brief.sourceName,
			outputDir: coverOutputDir,
			referenceImages: s5.referenceImages,
			generatorRepo: s5.generatorRepo,
			generatorCommit: s5.generatorCommit,
		});
		if (!thumbnailResult.success) return { status: "FAILED", stage: "thumbnail_generation", error: thumbnailResult.error };
		onProgress?.("publish_package");
		const packageInput: PublishPackageInput = {
			outputDir: path.join(coverOutputDir, "publish-review-package"),
			finalVideoPath: renderResult.outputPath,
			thumbnailPath: thumbnailResult.data.thumbnailPath,
			thumbnailManifestPath: thumbnailResult.data.manifestPath,
			thumbnailEvidence: thumbnailResult.data.evidence,
			source: s5.source,
			editorialSelection: { headline: editPlan.headline, statement: brief.editorialAngle },
			physicalTiming: { sourceStart: editPlan.statementStart, sourceEnd: editPlan.statementEnd, openingDirect: true, endingDirect: true },
			framingPolicy: s5.framingPolicy,
			materialSources: s5.materialSources,
			publication: s5.publication,
			modules: s5.modules,
			reviewFlags: s5.reviewFlags,
		};
		const packageResult = await (input.buildPackage ?? buildPublishReviewPackage)(packageInput);
		if (packageResult.status !== "PASS") return { status: "FAILED", stage: "publish_package", error: "BLOCKED_QC: publish package QC failed" };
		bundle.publishPackagePath = packageResult.packageDir;
	}

	return { status: "READY", bundle };
}

/**
 * Canonical finalization binding for Auto Production. Physical trust must be a
 * validated audio-alignment timeline (never CC/transcript words); render trust
 * must come from a canonical renderer capability (never a claimed string).
 */
function defaultFinalize(input: {
	transcriptWords?: WordTimestamp[];
	renderResult: RenderAutoProductionResult;
	qcChecks: Array<{ id: string; status: string }>;
	physicalTimeline?: unknown;
}): ProductionArtifactManifest {
	const qcChecks: Record<string, string> = {};
	for (const check of input.qcChecks) qcChecks[check.id] = check.status;

	// `transcriptWords` is NOT physical authority. Only a value carrying the
	// private audio-alignment capability is accepted.
	const physicalTimeline = isTrustedPhysicalTimeline(input.physicalTimeline) ? input.physicalTimeline : undefined;

	// The render result must carry the canonical render capability; a plain
	// render result object (as produced today) is not trusted.
	const renderTrusted = isTrustedRenderResult(input.renderResult.trustedRenderResult)
		? input.renderResult.trustedRenderResult
		: undefined;

	const result = finalizeProductionArtifact({
		physicalTimeline,
		renderResult: renderTrusted,
		qcChecks,
	});
	return result.ok ? result.manifest : { artifactStatus: "blocked", reasons: result.reasons };
}

// --- Helpers --------------------------------------------------------------

function mapPlanningFailure(
	planning: PlanningFailure,
): AutoProductionJobFailed {
	return {
		status: "FAILED",
		stage: mapPlanningStage(planning.stage),
		error: planning.error,
	};
}

interface PlanningFailure {
	success: false;
	error: string;
	stage: string;
}

function mapPlanningStage(stage: string): AutoProductionStage {
	switch (stage) {
		case "prepare_source":
			return "preparing_source";
		case "transcribe":
			return "transcript_ready";
		case "select_statement":
			return "selecting_statement";
		default:
			return "preparing_source";
	}
}

function mapRenderStage(stage: string): AutoProductionStage {
	switch (stage) {
		case "validate_input":
		case "build_command":
			return "preparing_graphics";
		case "generate_subtitles":
		case "ffmpeg_render":
			return "rendering";
		case "verify_output":
			return "running_qc";
		default:
			return "rendering";
	}
}
