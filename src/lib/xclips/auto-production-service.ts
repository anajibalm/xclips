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
import type { WordTimestamp } from "@/lib/xclips/types";
import * as path from "path";

// Re-export pure helper from client-safe module
export { detectSourceType } from "@/lib/xclips/auto-production-helpers";

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
	| "running_qc";

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
	stage: AutoProductionStage | "cover_generation" | "qc";
	error: string;
}

/** All artifacts from a successful job needed for deterministic rerender. */
export interface AutoProductionJobBundle {
	videoPath: string;
	coverPath: string;
	qc: QcResult;
	editPlan: EditPlan;
	preset: AccountPreset;
	/** Planning context preserved for Render Again (no re-ingest/transcribe). */
	rerenderContext: RerenderJobContext;
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
		}) => Promise<QcResult>;
	};
}

// --- Entry Point: Full Job (Plan → Render → Cover → QC) -------------------

export async function runAutoProductionJob(
	input: RunAutoProductionJobInput,
): Promise<AutoProductionJobResult> {
	const { brief, deps, outputDir, onProgress, _overrides } = input;

	const doRender = _overrides?.render ?? renderAutoProduction;
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

	// Build rerender context from planning result
	const rerenderContext: RerenderJobContext = {
		brief,
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
	});
}

// --- Entry Point: Rerender Only (No Planning) -----------------------------

export interface RerenderAutoProductionJobInput {
	context: RerenderJobContext;
	outputDir?: string;
	onProgress?: (stage: AutoProductionStage) => void;
	_overrides?: RunAutoProductionJobInput["_overrides"];
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

	const doRender = _overrides?.render ?? renderAutoProduction;
	const doCover = _overrides?.cover ?? generateAutoProductionCover;
	const doQc = _overrides?.qc ?? runAutoProductionQc;

	return executeRenderCoverQc({
		rerenderContext: context,
		outputDir,
		onProgress,
		doRender,
		doCover,
		doQc,
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
}

async function executeRenderCoverQc(
	input: ExecuteInput,
): Promise<AutoProductionJobResult> {
	const { rerenderContext, outputDir, onProgress, doRender, doCover, doQc } =
		input;
	const { brief, preset, editPlan, transcriptWords, sourceVideoPath, sourceWidth, sourceHeight } =
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

	return { status: "READY", bundle };
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
