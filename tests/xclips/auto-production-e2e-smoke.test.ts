import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import { runAutoProductionJob } from "@/lib/xclips/auto-production-service";
import type { ProductionBrief } from "@/lib/xclips/auto-production-types";
import type { AutoProductionDeps } from "@/lib/xclips/auto-production-orchestrator";
import type {
	XclipsProject,
	XclipsTranscript,
	XclipsClip,
} from "@/lib/xclips/types";

// ============================================================
// Real Service E2E Smoke — Slice 5 Acceptance Repair
// ============================================================
// Mocks only AI planning deps (ingest, transcribe, discoverHighlights).
// Uses REAL renderer, REAL cover generator, REAL QC.
// Fixture: vault/xclips/test-fixtures/auto-prod-smoke.mp4 (1080×1920, 40s, 30fps)

const FIXTURE_PATH = path.resolve(
	process.cwd(),
	"vault",
	"xclips",
	"test-fixtures",
	"auto-prod-smoke.mp4",
);
const OUTPUT_DIR = path.resolve(
	process.cwd(),
	"vault",
	"xclips",
	"test-fixtures",
	"e2e-smoke-output",
);

// Transcript words covering the full 10–45s statement range
const E2E_TRANSCRIPT_WORDS = Array.from({ length: 70 }, (_, i) => ({
	word: `word${i}`,
	start: 10 + i * 0.5,
	end: 10 + (i + 1) * 0.5,
}));

const e2eProject: XclipsProject = {
	id: "proj_e2e_smoke",
	name: "E2E Smoke Video",
	sourceType: "local",
	sourcePath: FIXTURE_PATH,
	durationSec: 40,
	width: 1080,
	height: 1920,
	frameRate: 30,
	isVfr: false,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const e2eTranscript: XclipsTranscript = {
	id: "tr_e2e_smoke",
	projectId: "proj_e2e_smoke",
	label: "E2E Test Transcript",
	sourceType: "ai",
	isActive: true,
	language: "id",
	rawText: E2E_TRANSCRIPT_WORDS.map((w) => w.word).join(" "),
	words: E2E_TRANSCRIPT_WORDS,
	srtContent: "",
	createdAt: new Date().toISOString(),
};

const e2eHighlight: XclipsClip = {
	id: "clip_e2e_smoke",
	projectId: "proj_e2e_smoke",
	title: "E2E Smoke Test Statement",
	hookText: "This is a test statement for E2E validation",
	viralScore: 90,
	startSec: 10,
	endSec: 45,
	aspectRatio: "9:16",
	layoutMode: "blur_bg",
	panOffsetX: 0,
	subtitleStyle: {
		enabled: true,
		preset: "plain",
		fontFamily: "Inter",
		fontSize: 44,
		primaryColor: "#FFFFFF",
		secondaryColor: "#FFFFFF",
		highlightColor: "#FFFFFF",
		outlineColor: "#000000",
		outlineWidth: 2.0,
		boxColor: "#000000",
		boxOpacity: 0.0,
		karaokeEnabled: false,
		allCaps: false,
		textCase: "uppercase",
		autoEmoji: false,
		positionX: 50,
		positionY: 80,
		rotation: 0,
		boxWidthMode: "custom",
		boxWidth: 76,
		scaleX: 1,
		scaleY: 1,
	},
	removeFillers: true,
	removeSilence: true,
	customCuts: [],
	status: "draft",
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const e2eBrief: ProductionBrief = {
	source: { sourcePath: FIXTURE_PATH, sourceType: "local" },
	editorialAngle: "E2E smoke test validation",
	editorialFunction: "Public communication / information integrity",
	accountPresetId: "shadow",
	sourceName: "E2E Test Source",
	sourceDate: "2026-09-07",
	accountHandle: "@e2etest",
	sourceRole: "Tester",
	brollPool: [],
};

function makeE2EDeps(overrides?: Partial<AutoProductionDeps>): AutoProductionDeps {
	return {
		ingestLocalFile: async () => ({ success: true, data: e2eProject }),
		ingestYouTubeUrl: async () => ({ success: true, data: e2eProject }),
		getExistingTranscript: async () => ({
			success: true,
			data: null,
		}),
		transcribeProject: async () => ({ success: true, data: e2eTranscript }),
		discoverHighlights: async () => ({ success: true, data: [e2eHighlight] }),
		generateHeadline: async () => ({ success: true, data: { headline: "word10 word11 word12" } }),
		...overrides,
	};
}

// --- Cleanup ----------------------------------------------------------------

function cleanupOutputDir() {
	if (fs.existsSync(OUTPUT_DIR)) {
		const files = fs.readdirSync(OUTPUT_DIR);
		for (const file of files) {
			fs.unlinkSync(path.join(OUTPUT_DIR, file));
		}
		fs.rmdirSync(OUTPUT_DIR);
	}
}

// --- Tests ------------------------------------------------------------------

describe("real service E2E smoke", () => {
	beforeAll(() => {
		cleanupOutputDir();
	});

	afterAll(() => {
		cleanupOutputDir();
	});

	it("should produce READY with real render, cover, and QC", async () => {
		const result = await runAutoProductionJob({
			brief: e2eBrief,
			deps: makeE2EDeps(),
			outputDir: OUTPUT_DIR,
		});

		// Debug: log the result if not READY
		if (result.status !== "READY") {
			console.error("E2E SMOKE FAILED:", JSON.stringify(result, null, 2));
		}

		// Must be READY — a FAILED result is NOT an E2E pass
		expect(result.status).toBe("READY");

		if (result.status === "READY") {
			// final.mp4 must exist and be non-empty
			expect(fs.existsSync(result.bundle.videoPath)).toBe(true);
			const videoStat = fs.statSync(result.bundle.videoPath);
			expect(videoStat.size).toBeGreaterThan(0);

			// cover.jpg must exist and be non-empty
			expect(fs.existsSync(result.bundle.coverPath)).toBe(true);
			const coverStat = fs.statSync(result.bundle.coverPath);
			expect(coverStat.size).toBeGreaterThan(0);

			// QC verdict must be READY
			expect(result.bundle.qc.verdict).toBe("READY");
			expect(result.bundle.qc.failedCount).toBe(0);

			// RerenderContext must be populated
			expect(result.bundle.rerenderContext.brief).toBe(e2eBrief);
			expect(result.bundle.rerenderContext.transcriptWords.length).toBe(70);
			expect(result.bundle.rerenderContext.sourceVideoPath).toBe(FIXTURE_PATH);
		}
	});

	it("should produce deterministic output paths (final.mp4, cover.jpg)", async () => {
		const result = await runAutoProductionJob({
			brief: e2eBrief,
			deps: makeE2EDeps(),
			outputDir: OUTPUT_DIR,
		});

		expect(result.status).toBe("READY");
		if (result.status === "READY") {
			expect(result.bundle.videoPath).toMatch(/\/final_\d+\.mp4$/);
			expect(result.bundle.coverPath).toMatch(/\/cover_\d+\.jpg$/);
		}
	});

	it("should route sub-30s statement to NEEDS_REVIEW with duration reason (no filler)", async () => {
		const shortHighlight: XclipsClip = {
			...e2eHighlight,
			id: "clip_e2e_short",
			startSec: 10,
			endSec: 35, // 25s < 30s review threshold
		};
		const deps = makeE2EDeps({
			discoverHighlights: async () => ({ success: true, data: [shortHighlight] }),
		});
		const result = await runAutoProductionJob({
			brief: e2eBrief,
			deps,
			outputDir: OUTPUT_DIR,
		});

		// Must NOT be a technical failure — the short statement still renders
		expect(result.status).toBe("NEEDS_REVIEW");
		if (result.status === "NEEDS_REVIEW") {
			// Exact statement bounds preserved — nothing stretched to reach 30s
			expect(result.bundle.editPlan.statementStart).toBe(10);
			expect(result.bundle.editPlan.statementEnd).toBe(35);
			// Machine-readable duration cause present
			expect(result.reasons.join(" ")).toContain("25.0s");
			// Real output still produced
			expect(fs.existsSync(result.bundle.videoPath)).toBe(true);
			expect(fs.existsSync(result.bundle.coverPath)).toBe(true);
		}
	});
});
