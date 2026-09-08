// ============================================================
// Auto Production API — Client-safe API layer
// ============================================================
// No Node.js imports. Only apiFetch + Zod schemas + pure helpers.
// This is the ONLY module the React page should import.

import { apiFetch } from "@/lib/api-client";
import { detectSourceType } from "@/lib/xclips/auto-production-helpers";
import type {
	AccountPresetId,
	ProductionBrief,
} from "@/lib/xclips/auto-production-types";

// Re-export pure helper and types for page convenience
export { detectSourceType } from "@/lib/xclips/auto-production-helpers";
export type { AccountPresetId, ProductionBrief } from "@/lib/xclips/auto-production-types";

// --- Serializable types matching backend AutoProductionJobResult ------------

export type AutoProductionStage =
	| "preparing_source"
	| "transcript_ready"
	| "selecting_statement"
	| "preparing_graphics"
	| "rendering"
	| "running_qc";

export interface AutoProductionQcSummary {
	passedCount: number;
	reviewCount: number;
	failedCount: number;
}

export interface AutoProductionQcCheck {
	id: string;
	category: string;
	status: "PASS" | "REVIEW" | "FAIL";
	message: string;
}

export interface AutoProductionJobBundle {
	videoPath: string;
	coverPath: string;
	qc: AutoProductionQcSummary;
	editPlan: {
		statementStart: number;
		statementEnd: number;
		headline: string;
		statementSignal: { confidence: string; warnings: string[] };
	};
	preset: {
		id: AccountPresetId;
		label: string;
		width: number;
		height: number;
		fps: number;
	};
	rerenderContext: RerenderJobContext;
}

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

// --- Serializable RerenderJobContext (subset for browser transport) --------

export interface RerenderJobContext {
	brief: ProductionBrief;
	preset: { id: AccountPresetId; label: string };
	editPlan: {
		statementStart: number;
		statementEnd: number;
		headline: string;
		brollPlacements: { assetId: string; startSec: number; endSec: number }[];
		statementSignal: { confidence: string; warnings: string[] };
		brollSignal: { confidence: string; warnings: string[] };
		headlineSignal: { confidence: string; warnings: string[] };
	};
	transcriptWords: { word: string; start: number; end: number }[];
	sourceVideoPath: string;
	sourceWidth: number;
	sourceHeight: number;
}

// --- Request builders (client-safe helpers) --------------------------------

export interface BuildAutoProductionBriefInput {
	sourcePath: string;
	editorialAngle: string;
	editorialFunction: string;
	accountPresetId: AccountPresetId;
	sourceName: string;
	sourceDate?: string;
	accountHandle: string;
	sourceRole?: string;
	sensitiveContent?: boolean;
	contextIntegrityConfirmed?: boolean;
}

/**
 * Build a valid ProductionBrief from form state.
 * Uses client-safe detectSourceType — no server imports.
 */
export function buildAutoProductionBrief(
	input: BuildAutoProductionBriefInput,
): ProductionBrief {
	const sourceType = detectSourceType(input.sourcePath.trim());
	return {
		source: { sourcePath: input.sourcePath.trim(), sourceType },
		editorialAngle: input.editorialAngle.trim(),
		editorialFunction: input.editorialFunction.trim(),
		accountPresetId: input.accountPresetId,
		sourceName: input.sourceName.trim(),
		sourceDate: input.sourceDate?.trim() || undefined,
		accountHandle: input.accountHandle.trim(),
		sourceRole: input.sourceRole?.trim() || undefined,
		sensitiveContent: input.sensitiveContent ?? false,
		contextIntegrityConfirmed: input.contextIntegrityConfirmed,
		brollPool: [],
	};
}

// --- API calls -------------------------------------------------------------

export async function generateAutoProduction(
	brief: ProductionBrief,
): Promise<AutoProductionJobResult> {
	const res = await apiFetch<AutoProductionJobResult>(
		"/api/xclips/auto-production/jobs",
		{
			method: "POST",
			body: JSON.stringify({ brief }),
		},
	);
	if (!res.ok || !res.data) {
		return { status: "FAILED", stage: "preparing_source", error: res.message || "API request failed" };
	}
	return res.data;
}

export async function rerenderAutoProduction(
	context: RerenderJobContext,
): Promise<AutoProductionJobResult> {
	const res = await apiFetch<AutoProductionJobResult>(
		"/api/xclips/auto-production/rerender",
		{
			method: "POST",
			body: JSON.stringify({ context }),
		},
	);
	if (!res.ok || !res.data) {
		return { status: "FAILED", stage: "rendering", error: res.message || "API request failed" };
	}
	return res.data;
}

export async function regenerateAutoProduction(
	brief: ProductionBrief,
): Promise<AutoProductionJobResult> {
	const res = await apiFetch<AutoProductionJobResult>(
		"/api/xclips/auto-production/regenerate",
		{
			method: "POST",
			body: JSON.stringify({ brief }),
		},
	);
	if (!res.ok || !res.data) {
		return { status: "FAILED", stage: "preparing_source", error: res.message || "API request failed" };
	}
	return res.data;
}
