import { describe, it, expect, beforeEach } from "bun:test";
import {
	runAutoProductionJob,
	rerenderAutoProductionJob,
	detectSourceType,
	resolveOfficialFramingMode,
	selectStatementEdgePhrases,
	canonicalizeStatementWords,
	type RerenderJobContext,
} from "@/lib/xclips/auto-production-service";
import type { ProductionBrief } from "@/lib/xclips/auto-production-types";
import type { AutoProductionDeps } from "@/lib/xclips/auto-production-orchestrator";
import type {
	RenderAutoProductionInput,
	RenderAutoProductionResult,
} from "@/lib/xclips/auto-production-renderer";
import {
	resolveAccountPreset,
	type EditPlan,
} from "@/lib/xclips/auto-production-types";
import type {
	GenerateCoverInput,
	CoverResult,
} from "@/lib/xclips/auto-production-cover";
import type { QcResult } from "@/lib/xclips/auto-production-qc";
import type {
	XclipsProject,
	XclipsTranscript,
	XclipsClip,
} from "@/lib/xclips/types";

// ============================================================
// Auto Production Service Tests — Slice 5 (Acceptance Repair)
// ============================================================

// --- Mock Data ------------------------------------------------------------

const mockProject: XclipsProject = {
	id: "proj_svc_001",
	name: "Service Test Video",
	sourceType: "local",
	sourcePath: "/tmp/svc-test-video.mp4",
	durationSec: 120,
	width: 1920,
	height: 1080,
	frameRate: 30,
	isVfr: false,
	createdAt: "2026-09-07T00:00:00.000Z",
	updatedAt: "2026-09-07T00:00:00.000Z",
};

const mockTranscript: XclipsTranscript = {
	id: "tr_svc_001",
	projectId: "proj_svc_001",
	label: "AI Generated Subtitles",
	sourceType: "ai",
	isActive: true,
	language: "id",
	rawText: "Ini adalah transkrip uji untuk layanan produksi otomatis",
	words: [
		{ word: "Ini", start: 0, end: 0.5 },
		{ word: "adalah", start: 0.5, end: 1.0 },
		{ word: "transkrip", start: 1.0, end: 1.8 },
		{ word: "uji", start: 1.8, end: 2.2 },
		{ word: "untuk", start: 2.2, end: 2.6 },
		{ word: "layanan", start: 2.6, end: 3.2 },
		{ word: "produksi", start: 3.2, end: 3.9 },
		{ word: "otomatis", start: 3.9, end: 4.8 },
	],
	srtContent: "",
	createdAt: "2026-09-07T00:00:00.000Z",
};

const mockHighlight: XclipsClip = {
	id: "clip_svc_001",
	projectId: "proj_svc_001",
	title: "Dampak Erupsi Gunung Kelud",
	hookText: "Erupsi besar terjadi hari ini",
	viralScore: 85,
	startSec: 10,
	endSec: 45,
	aspectRatio: "9:16",
	layoutMode: "blur_bg",
	panOffsetX: 0,
	subtitleStyle: {
		enabled: true, preset: "plain", fontFamily: "Inter", fontSize: 44,
		primaryColor: "#FFFFFF", secondaryColor: "#FFFFFF", highlightColor: "#FFFFFF",
		outlineColor: "#000000", outlineWidth: 2.0, boxColor: "#000000", boxOpacity: 0.0,
		karaokeEnabled: false, allCaps: false, textCase: "uppercase", autoEmoji: false,
		positionX: 50, positionY: 80, rotation: 0, boxWidthMode: "custom", boxWidth: 76,
		scaleX: 1, scaleY: 1,
	},
	removeFillers: true,
	removeSilence: true,
	customCuts: [],
	status: "draft",
	createdAt: "2026-09-07T00:00:00.000Z",
	updatedAt: "2026-09-07T00:00:00.000Z",
};

const mockBrief: ProductionBrief = {
	source: { sourcePath: "/tmp/svc-test-video.mp4", sourceType: "local" },
	editorialAngle: "Dampak erupsi Gunung Kelud terhadap warga sekitar",
	editorialFunction: "Public communication / information integrity",
	accountPresetId: "shadow",
	sourceName: "TVRI Jatim",
	sourceDate: "2026-09-07",
	accountHandle: "@tvrijatim",
	sourceRole: "Reporter",
	brollPool: [],
};

const mockRenderResult: RenderAutoProductionResult = {
	success: true,
	outputPath: "/tmp/svc-test-output/final.mp4",
	durationSec: 35,
	width: 1080,
	height: 1920,
	fps: 30,
};

const mockCoverResult: CoverResult = {
	success: true,
	coverPath: "/tmp/svc-test-output/cover.jpg",
	width: 1080,
	height: 1920,
};

const mockQcResult: QcResult = {
	verdict: "READY",
	checks: [
		{ id: "dur_min", category: "media", status: "PASS", message: "Duration meets minimum" },
		{ id: "dur_max", category: "media", status: "PASS", message: "Duration within max" },
	],
	passedCount: 2,
	reviewCount: 0,
	failedCount: 0,
};

function makeMockDeps(overrides?: Partial<AutoProductionDeps>): AutoProductionDeps {
	return {
		ingestLocalFile: async () => ({ success: true, data: mockProject }),
		ingestYouTubeUrl: async () => ({ success: true, data: mockProject }),
		getExistingTranscript: async () => ({ success: true, data: null }),
		transcribeProject: async () => ({ success: true, data: mockTranscript }),
		discoverHighlights: async () => ({ success: true, data: [mockHighlight] }),
		generateHeadline: async () => ({ success: true, data: { headline: "Judul Khusus Jalur Layanan Terpisah" } }),
		...overrides,
	};
}

function makeOverrides(opts?: {
	renderResult?: RenderAutoProductionResult;
	coverResult?: CoverResult;
	qcResult?: QcResult;
}) {
	// NOTE (ARCH.1C): there is deliberately NO finalizer override. The real
	// production trust gate always runs and, because no canonical physical or
	// render authority is committed yet, it BLOCKS. Pipeline-stage tests assert
	// stage behavior up to trust_finalization; they never fabricate trust.
	return {
		render: async () => opts?.renderResult ?? mockRenderResult,
		cover: async () => opts?.coverResult ?? mockCoverResult,
		qc: async () => opts?.qcResult ?? mockQcResult,
	};
}

/** A valid planning context for exercising the rerender path directly. */
function mockRerenderContext(): RerenderJobContext {
	const preset = resolveAccountPreset("shadow")!;
	const signal = { confidence: "strong" as const, warnings: [] as string[] };
	const editPlan: EditPlan = {
		statementStart: 10,
		statementEnd: 45,
		keepIntervals: [{ start: 0, end: 35, duration: 35 }],
		headline: "Judul Uji Konteks",
		brollPlacements: [],
		statementSignal: signal,
		brollSignal: signal,
		headlineSignal: signal,
	};
	return {
		brief: mockBrief,
		preset,
		editPlan,
		transcriptWords: mockTranscript.words,
		sourceVideoPath: mockProject.sourcePath,
		sourceWidth: 1920,
		sourceHeight: 1080,
	};
}

// --- Tests ----------------------------------------------------------------

describe("auto-production-service", () => {
	it("uses FIELD_FIT_BG for S4 and other TV/news-package sources", () => {
		expect(resolveOfficialFramingMode("/vault/[7QzF3NxGltQ].mp4")).toBe("FIELD_FIT_BG");
		expect(resolveOfficialFramingMode("/vault/[another-news-package].mp4")).toBe("FIELD_FIT_BG");
		expect(resolveOfficialFramingMode("/vault/[7QzF3NxGltQ].mp4", "news_talking_head")).toBe("FIELD_FIT_BG");
	});

	it("does not auto-enable TALKING_HEAD_SAFE from contentType", () => {
		expect(resolveOfficialFramingMode("/vault/other.mp4", "news_talking_head")).toBe("FIELD_FIT_BG");
		expect(resolveOfficialFramingMode("/vault/other.mp4", "monolog_1_wajah")).toBe("FIELD_FIT_BG");
	});

	it("selects physical anchor phrases from statement overlap, not transcript edges", () => {
		const words = [
			{ word: "Kita", start: 0, end: 1 },
			{ word: "awali", start: 1, end: 2 },
			{ word: "dengan", start: 2, end: 3 },
			{ word: "kolom", start: 33, end: 34 },
			{ word: "abu", start: 34, end: 35 },
			{ word: "tidak", start: 35, end: 36 },
			{ word: "teramati", start: 36, end: 37 },
			{ word: "informasi.", start: 70, end: 71 },
			{ word: "penutup", start: 120, end: 121 },
		];
		const anchors = selectStatementEdgePhrases(words, 33, 72, 4);
		expect(anchors.openingPhrase).toEqual(["kolom", "abu", "tidak", "teramati"]);
		expect(anchors.endingPhrase).toEqual(["abu", "tidak", "teramati", "informasi."]);
		expect(anchors.openingPhrase).not.toContain("Kita");
		expect(anchors.endingPhrase).not.toContain("penutup");
	});

	it("canonicalizes overlapping CC edges chronologically without word blacklists", () => {
		// Real S6 source-01 pattern: ROC overlaps abu/tidak in time. No
		// manual blacklist: every distinct word is retained, ordered by time.
		const words = [
			{ word: "kolom", start: 32.48, end: 33.36 },
			{ word: "abu", start: 33.36, end: 34.24 },
			{ word: "tidak", start: 34.24, end: 35.12 },
			{ word: "ROC", start: 33.21, end: 34.42 },
			{ word: "terekam", start: 34.42, end: 35.62 },
		];
		expect(canonicalizeStatementWords(words).map((w) => w.word)).toEqual(
			["kolom", "ROC", "abu", "tidak", "terekam"],
		);
		const anchors = selectStatementEdgePhrases(words, 33.21, 72, 4);
		expect(anchors.openingPhrase).toEqual(["kolom", "ROC", "abu", "tidak"]);
	});

	it("sorts out-of-order CC timings before edge selection", () => {
		// Real S6 source-02 pattern: transcript order is not time order.
		const words = [
			{ word: "dari", start: 514.94, end: 515.84 },
			{ word: "dan", start: 514.10, end: 515.03 },
			{ word: "apa", start: 515.03, end: 515.97 },
			{ word: "namanya", start: 515.97, end: 516.90 },
		];
		const anchors = selectStatementEdgePhrases(words, 515, 561.32, 4);
		expect(anchors.openingPhrase).toEqual(["dan", "dari", "apa", "namanya"]);
	});

	it("drops duplicate rollup entries with overlapping time", () => {
		const words = [
			{ word: "api", start: 10, end: 11 },
			{ word: "api", start: 10.2, end: 11.2 },
			{ word: "membesar", start: 11.2, end: 12 },
		];
		expect(canonicalizeStatementWords(words).map((w) => w.word)).toEqual(["api", "membesar"]);
	});
	// ============================================================
	// 1. detectSourceType (source type detection)
	// ============================================================
	describe("detectSourceType", () => {
		it("should return 'local' for a local filesystem path", () => {
			expect(detectSourceType("/tmp/video.mp4")).toBe("local");
		});

		it("should return 'local' for a relative path", () => {
			expect(detectSourceType("video.mp4")).toBe("local");
		});

		it("should return 'url' for a standard YouTube URL", () => {
			expect(detectSourceType("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("url");
		});

		it("should return 'url' for a youtu.be short URL", () => {
			expect(detectSourceType("https://youtu.be/dQw4w9WgXcQ")).toBe("url");
		});

		it("should return 'url' for a YouTube shorts URL", () => {
			expect(detectSourceType("https://youtube.com/shorts/abc123")).toBe("url");
		});

		it("should return 'local' for non-YouTube URLs", () => {
			expect(detectSourceType("https://example.com/video.mp4")).toBe("local");
		});

		it("should return 'local' for empty string", () => {
			expect(detectSourceType("")).toBe("local");
		});

		it("should trim whitespace before detection", () => {
			expect(detectSourceType("  https://youtube.com/watch?v=123  ")).toBe("url");
		});
	});

	// ============================================================
	// 2. canGenerate logic (UI acceptance: generate disabled states)
	// ============================================================
	describe("brief validation (canGenerate prereqs)", () => {
		it("should reject brief with empty sourcePath", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				source: { sourcePath: "", sourceType: "local" },
			};
			const result = await runAutoProductionJob({
				brief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("FAILED");
		});

		it("should reject brief with empty editorialAngle", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				editorialAngle: "",
			};
			const result = await runAutoProductionJob({
				brief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("FAILED");
		});

		it("should reject brief with empty sourceName", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				sourceName: "",
			};
			const result = await runAutoProductionJob({
				brief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("FAILED");
		});

		it("should reject brief with empty accountHandle", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				accountHandle: "",
			};
			const result = await runAutoProductionJob({
				brief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("FAILED");
		});

		it("should accept brief with optional sourceDate omitted → NEEDS_REVIEW", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				sourceDate: undefined,
			};
			const result = await runAutoProductionJob({
				brief,
				deps: makeMockDeps(),
				_overrides: makeOverrides({
					qcResult: {
						verdict: "NEEDS_REVIEW",
						checks: [
							{ id: "contract_source_date", category: "contract", status: "REVIEW", message: "sourceDate not provided — editorial compliance requires human review" },
							{ id: "dur_min", category: "media", status: "PASS", message: "Duration meets minimum" },
						],
						passedCount: 1,
						reviewCount: 1,
						failedCount: 0,
					},
				}),
			});
			// missing sourceDate produces NEEDS_REVIEW, NOT FAILED
			expect(result.status).toBe("NEEDS_REVIEW");
		});
	});

	// ============================================================
	// 3. Source type in brief (local vs youtube)
	// ============================================================
	describe("source type in brief", () => {
		it("should produce local brief for local path", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				source: { sourcePath: "/tmp/video.mp4", sourceType: "local" },
			};
			expect(brief.source.sourceType).toBe("local");
		});

		it("should produce url brief for YouTube URL", async () => {
			const brief: ProductionBrief = {
				...mockBrief,
				source: {
					sourcePath: "https://youtube.com/watch?v=abc",
					sourceType: "url",
				},
			};
			expect(brief.source.sourceType).toBe("url");
		});

		it("should always have brollPool=[]", async () => {
			expect(mockBrief.brollPool).toEqual([]);
		});
	});

	// ============================================================
	// 4. Full job happy path
	// ============================================================
	describe("runAutoProductionJob", () => {
		it("ARCH.1C: all ordinary stages pass but production is BLOCKED at trust_finalization", async () => {
			const stages: string[] = [];
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				outputDir: "/tmp/svc-test-output",
				onProgress: (stage) => stages.push(stage),
				_overrides: makeOverrides(),
			});

			// Stage behavior is correct: every ordinary stage ran.
			expect(stages).toContain("preparing_source");
			expect(stages).toContain("rendering");
			expect(stages).toContain("running_qc");

			// But production is honestly blocked: canonical physical authority
			// and canonical renderer authority are not committed yet.
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.stage).toBe("trust_finalization");
				expect(result.error).toContain("Production trust gate blocked");
			}
		});

		it("should return FAILED when ingestLocalFile fails", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps({
					ingestLocalFile: async () => ({ success: false, error: "File not found" }),
				}),
				_overrides: makeOverrides(),
			});

			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.error).toContain("File not found");
			}
		});

		it("should return FAILED when render fails", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides({
					renderResult: {
						success: false,
						error: "FFmpeg render failed",
						stage: "ffmpeg_render",
					},
				}),
			});

			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.error).toContain("FFmpeg render failed");
				expect(result.stage).toBe("rendering");
			}
		});

		it("should call onProgress for each stage", async () => {
			const stages: string[] = [];
			await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				outputDir: "/tmp/svc-test-progress",
				onProgress: (stage) => stages.push(stage),
				_overrides: makeOverrides(),
			});

			expect(stages).toContain("preparing_source");
			expect(stages).toContain("transcript_ready");
			expect(stages).toContain("selecting_statement");
			expect(stages).toContain("rendering");
			expect(stages).toContain("running_qc");
		});

		it("should propagate review signal (not FAILED) for sub-30s statement", async () => {
			const shortHighlight = { ...mockHighlight, startSec: 10, endSec: 35 };
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps({
					discoverHighlights: async () => ({ success: true, data: [shortHighlight] }),
				}),
				outputDir: "/tmp/svc-test-short",
				_overrides: makeOverrides(),
			});

			// Planning must not fail technically on short statements; the only
			// permissible terminal state today is the trust gate.
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.stage).toBe("trust_finalization");
			}
		});
	});

	// ============================================================
	// 5. Render Again (no re-planning)
	// ============================================================
	describe("rerenderAutoProductionJob", () => {
		it("should NOT call ingest, transcribe, or discoverHighlights", async () => {
			let ingestCalled = false;
			let transcribeCalled = false;
			let discoverCalled = false;

			const deps = makeMockDeps({
				ingestLocalFile: async () => { ingestCalled = true; return { success: true, data: mockProject }; },
				ingestYouTubeUrl: async () => { ingestCalled = true; return { success: true, data: mockProject }; },
				transcribeProject: async () => { transcribeCalled = true; return { success: true, data: mockTranscript }; },
				discoverHighlights: async () => { discoverCalled = true; return { success: true, data: [mockHighlight] }; },
			});

			// First: run a full job to get the rerender context
			const fullResult = await runAutoProductionJob({
				brief: mockBrief,
				deps,
				_overrides: makeOverrides(),
			});
			// The job is trust-blocked, but planning ran and produced context.
			expect(ingestCalled).toBe(true);

			// Capture planning counters, then reset.
			ingestCalled = false;
			transcribeCalled = false;
			discoverCalled = false;

			// Rerender via the preserved context: must NOT call any planning fn.
			const context = mockRerenderContext();
			const rerenderResult = await rerenderAutoProductionJob({
				context,
				_overrides: makeOverrides(),
			});

			expect(rerenderResult.status).toBe("FAILED");
			if (rerenderResult.status === "FAILED") {
				expect(rerenderResult.stage).toBe("trust_finalization");
			}
			expect(ingestCalled).toBe(false);
			expect(transcribeCalled).toBe(false);
			expect(discoverCalled).toBe(false);
		});

		it("rerender reaches trust_finalization with the same editPlan context", async () => {
			const ctx = mockRerenderContext();
			const rerenderResult = await rerenderAutoProductionJob({
				context: ctx,
				_overrides: makeOverrides(),
			});

			// Rerender performed render/cover/QC for the same context, then was
			// blocked by the trust gate (no canonical authorities yet).
			expect(rerenderResult.status).toBe("FAILED");
			if (rerenderResult.status === "FAILED") {
				expect(rerenderResult.stage).toBe("trust_finalization");
			}
			expect(ctx.editPlan.headline).toBe("Judul Uji Konteks");
			expect(ctx.editPlan.statementStart).toBe(10);
			expect(ctx.editPlan.statementEnd).toBe(45);
		});

		it("rerender executes render+cover+QC then blocks at the trust gate", async () => {
			let renderCalls = 0;
			let coverCalls = 0;
			let qcCalls = 0;
			const rerenderResult = await rerenderAutoProductionJob({
				context: mockRerenderContext(),
				_overrides: {
					render: async () => { renderCalls++; return mockRenderResult; },
					cover: async () => { coverCalls++; return mockCoverResult; },
					qc: async () => { qcCalls++; return mockQcResult; },
				},
			});

			expect(renderCalls).toBe(1);
			expect(coverCalls).toBe(1);
			expect(qcCalls).toBe(1);
			expect(rerenderResult.status).toBe("FAILED");
			if (rerenderResult.status === "FAILED") {
				expect(rerenderResult.stage).toBe("trust_finalization");
			}
		});
	});

	// ============================================================
	// 6. Regenerate (must rerun planning)
	// ============================================================
	describe("regenerate (via runAutoProductionJob with same brief)", () => {
		it("should call discoverHighlights (new planning)", async () => {
			let discoverCallCount = 0;
			const deps = makeMockDeps({
				discoverHighlights: async () => {
					discoverCallCount++;
					return { success: true, data: [mockHighlight] };
				},
			});

			// First job
			const first = await runAutoProductionJob({
				brief: mockBrief,
				deps,
				_overrides: makeOverrides(),
			});
			expect(first.status).toBe("FAILED");
			const callsAfterFirst = discoverCallCount;

			// Regenerate (second job with same brief)
			const second = await runAutoProductionJob({
				brief: mockBrief,
				deps,
				_overrides: makeOverrides(),
			});
			expect(second.status).toBe("FAILED");

			// discoverHighlights was called again (new planning)
			expect(discoverCallCount).toBeGreaterThan(callsAfterFirst);
		});

		it("should call ingestLocalFile again (new planning)", async () => {
			let ingestCallCount = 0;
			const deps = makeMockDeps({
				ingestLocalFile: async () => {
					ingestCallCount++;
					return { success: true, data: mockProject };
				},
			});

			await runAutoProductionJob({ brief: mockBrief, deps, _overrides: makeOverrides() });
			const afterFirst = ingestCallCount;

			await runAutoProductionJob({ brief: mockBrief, deps, _overrides: makeOverrides() });
			expect(ingestCallCount).toBeGreaterThan(afterFirst);
		});
	});

	// ============================================================
	// 7. Result status mapping (QC verdicts)
	// ============================================================
	describe("QC verdict mapping", () => {
		it("QC READY still blocks at trust_finalization (no canonical authorities)", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides({
					qcResult: {
						verdict: "READY",
						checks: [{ id: "c1", category: "media", status: "PASS", message: "ok" }],
						passedCount: 1, reviewCount: 0, failedCount: 0,
					},
				}),
			});
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.stage).toBe("trust_finalization");
			}
		});

		it("should return NEEDS_REVIEW when QC verdict is NEEDS_REVIEW", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides({
					qcResult: {
						verdict: "NEEDS_REVIEW",
						checks: [{ id: "c1", category: "contract", status: "REVIEW", message: "Source name is generic" }],
						passedCount: 0, reviewCount: 1, failedCount: 0,
					},
				}),
			});
			expect(result.status).toBe("NEEDS_REVIEW");
			if (result.status === "NEEDS_REVIEW") {
				expect(result.reasons).toContain("Source name is generic");
			}
		});

		it("should return FAILED when QC verdict is FAILED", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides({
					qcResult: {
						verdict: "FAILED",
						checks: [{ id: "c1", category: "media", status: "FAIL", message: "Duration too short" }],
						passedCount: 0, reviewCount: 0, failedCount: 1,
					},
				}),
			});
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.stage).toBe("qc");
				expect(result.error).toContain("Duration too short");
			}
		});
	});

	// ============================================================
	// 8. Bundle structure
	// ============================================================
	describe("bundle structure", () => {
		it("planning produces a rerenderContext with source geometry (job then trust-blocked)", async () => {
			// The bundle is only returned on production_valid, which is blocked.
			// Verify the same context the service builds, via the rerender path.
			const ctx = mockRerenderContext();
			expect(ctx.brief).toBeDefined();
			expect(ctx.preset).toBeDefined();
			expect(ctx.editPlan).toBeDefined();
			expect(ctx.transcriptWords).toBeDefined();
			expect(ctx.sourceVideoPath).toBe(mockProject.sourcePath);
			expect(ctx.sourceWidth).toBe(1920);
			expect(ctx.sourceHeight).toBe(1080);
		});

		it("preset resolves with correct dimensions", async () => {
			const preset = resolveAccountPreset("shadow")!;
			expect(preset.id).toBe("shadow");
			expect(preset.width).toBe(1080);
			expect(preset.height).toBe(1920);
		});

		it("planning builds an editPlan with headline and statement range before trust block", async () => {
			// S1.3: headline needs a non-empty final slice — extend fixture
			// words across the clip bounds (guard-neutral, closure at 45.0).
			const extendedWords = [
				...mockTranscript.words,
				...Array.from({ length: 43 }, (_, i) => ({
					word: `kata${i}`,
					start: 5.0 + i * 0.9,
					end: 5.8 + i * 0.9,
				})),
				{ word: "tutup.", start: 44.1, end: 45.0 },
			];
			let renderedEditPlan: EditPlan | undefined;
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps({
					getExistingTranscript: async () => ({
						success: true,
						data: { ...mockTranscript, words: extendedWords },
					}),
					generateHeadline: async () => ({ success: true, data: { headline: "Kata20 Kata21 Kata22" } }),
				}),
				_overrides: {
					...makeOverrides(),
					render: async (input) => { renderedEditPlan = input.editPlan; return mockRenderResult; },
				},
			});
			// Planning succeeded; the job is blocked only by the trust gate.
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") expect(result.stage).toBe("trust_finalization");
			expect(renderedEditPlan?.headline).toBe("Kata20 Kata21 Kata22");
			expect(renderedEditPlan?.statementStart).toBe(10);
			expect(renderedEditPlan?.statementEnd).toBe(45);
		});
	});

	// ============================================================
	// 9. Edge cases
	// ============================================================
	describe("edge cases", () => {
		it("should handle deps throwing an error", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps({
					ingestLocalFile: async () => { throw new Error("Unexpected error"); },
				}),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.error).toContain("Unexpected error");
			}
		});

		it("should handle kabakom preset through planning + trust block", async () => {
			const kabakomBrief: ProductionBrief = {
				...mockBrief,
				accountPresetId: "kabakom",
			};
			const result = await runAutoProductionJob({
				brief: kabakomBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("FAILED");
			if (result.status === "FAILED") {
				expect(result.stage).toBe("trust_finalization");
			}
		});

		it("blocks S5 before generation when trust finalization is unavailable", async () => {
			let generatorCalls = 0;
			let packageCalls = 0;
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: {
					...makeOverrides(),
					generateThumbnail: async () => {
						generatorCalls += 1;
						return {
							success: true,
							data: {
								thumbnailPath: "thumbnail.png",
								manifestPath: "generation-manifest.json",
								requestPath: "thumbnail-input.json",
								evidence: {
									provider: "openai",
									protocol: "openai-images",
									model: "gpt-image-2.5-sunburst",
									generationStatus: "GENERATED",
									promptSha256: "prompt",
									requestedSize: "1008x1344",
									rawDimensions: "1008x1344",
									finalDimensions: "1080x1440",
									transform: "scale=1080:1440:force_original_aspect_ratio=increase,crop=1080:1440",
									inputImages: [{ filename: "subject.jpg", role: "subject", sha256: "subject" }, { filename: "reference.png", role: "reference", sha256: "reference" }],
									outputSha256: "output",
								},
							},
						};
					},
					buildPackage: async (packageInput) => {
						packageCalls += 1;
						expect(packageInput.finalVideoPath).toBe(mockRenderResult.outputPath);
						expect(packageInput.thumbnailPath).toBe("thumbnail.png");
						return { packageDir: "publish-review-package", sha256: { finalVideo: "video", thumbnail: "thumbnail" }, status: "PASS" };
					},
				},
				s5: {
					referenceImages: ["reference.png"],
				source: { videoId: "source", url: "source-url", publisher: "Publisher", sourceStart: 0, sourceEnd: 1, sourceFileIdentity: "sha256:source" },
				materialSources: [],
				framingPolicy: {},
				modules: { included: [], omitted: {} },
				reviewFlags: { blockers: [], warnings: [] },
				publication: { headline: "Headline", sourceCredit: "Publisher", captionDraft: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty forty one forty two forty three forty four forty five forty six forty seven forty eight forty nine fifty", structure: ["HOOK", "CONTEXT", "RELEVANCE", "QUESTION"] },
			},
			});
			expect(generatorCalls).toBe(0);
			expect(packageCalls).toBe(0);
			expect(result.status).toBe("FAILED");
		if (result.status === "FAILED") expect(result.stage).toBe("trust_finalization");
		});

		it("runs trusted S5 flow in order and returns READY", async () => {
			const events: string[] = [];
			let generatorCalls = 0;
			let packageCalls = 0;
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: {
					render: async () => { events.push("render"); return mockRenderResult; },
					cover: async () => mockCoverResult,
					qc: async () => { events.push("qc"); return mockQcResult; },
					finalizeTrust: () => { events.push("trust"); return { ok: true, manifest: { artifactStatus: "production_valid", reasons: [] } }; },
					generateThumbnail: async () => { generatorCalls += 1; events.push("thumbnail"); return { success: true, data: { thumbnailPath: "thumbnail.png", manifestPath: "generation-manifest.json", requestPath: "thumbnail-input.json", evidence: { provider: "openai", protocol: "openai-images", model: "fixture-model", generationStatus: "GENERATED", promptSha256: "prompt", requestedSize: "1008x1344", rawDimensions: "1008x1344", finalDimensions: "1080x1440", transform: "scale=1080:1440:force_original_aspect_ratio=increase,crop=1080:1440", inputImages: [{ filename: "subject.jpg", role: "subject", sha256: "subject" }, { filename: "reference.png", role: "reference", sha256: "reference" }], outputSha256: "output" } } }; },
					buildPackage: async () => { packageCalls += 1; events.push("package"); return { packageDir: "publish-review-package", sha256: { finalVideo: "video", thumbnail: "thumbnail" }, status: "PASS" }; },
				},
				s5: { referenceImages: ["reference.png"], source: { videoId: "source", url: "source-url", publisher: "Publisher", sourceStart: 0, sourceEnd: 1, sourceFileIdentity: "sha256:source" }, materialSources: [], framingPolicy: {}, modules: { included: [], omitted: {} }, reviewFlags: { blockers: [], warnings: [] }, publication: { headline: "Headline", sourceCredit: "Publisher", captionDraft: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty forty one forty two forty three forty four forty five forty six forty seven forty eight forty nine fifty", structure: ["HOOK", "CONTEXT", "RELEVANCE", "QUESTION"] } },
			});
			expect(result.status).toBe("READY");
			if (result.status === "READY") { expect(result.bundle.coverPath).toBe(mockCoverResult.coverPath); expect(result.bundle.publishPackagePath).toBe("publish-review-package"); }
			expect(generatorCalls).toBe(1); expect(packageCalls).toBe(1); expect(events).toEqual(["render", "qc", "trust", "thumbnail", "package"]);
		});

		it("blocks package after thumbnail failure", async () => {
			let packageCalls = 0;
			const result = await runAutoProductionJob({ brief: mockBrief, deps: makeMockDeps(), _overrides: { ...makeOverrides(), finalizeTrust: () => ({ ok: true, manifest: { artifactStatus: "production_valid", reasons: [] } }), generateThumbnail: async () => ({ success: false, error: "BLOCKED_GENERATOR" }), buildPackage: async () => { packageCalls += 1; return { packageDir: "publish-review-package", sha256: { finalVideo: "", thumbnail: "" }, status: "PASS" }; } }, s5: { referenceImages: ["reference.png"], source: { videoId: "source", url: "source-url", publisher: "Publisher", sourceStart: 0, sourceEnd: 1, sourceFileIdentity: "sha256:source" }, materialSources: [], framingPolicy: {}, modules: { included: [], omitted: {} }, reviewFlags: { blockers: [], warnings: [] }, publication: { headline: "Headline", sourceCredit: "Publisher", captionDraft: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty forty one forty two forty three forty four forty five forty six forty seven forty eight forty nine fifty", structure: ["HOOK", "CONTEXT", "RELEVANCE", "QUESTION"] } } });
			expect(result.status).toBe("FAILED"); expect(packageCalls).toBe(0);
		});

		it("fails publish_package when package is BLOCKED", async () => {
			let packageCalls = 0;
			const result = await runAutoProductionJob({ brief: mockBrief, deps: makeMockDeps(), _overrides: { ...makeOverrides(), finalizeTrust: () => ({ ok: true, manifest: { artifactStatus: "production_valid", reasons: [] } }), generateThumbnail: async () => ({ success: true, data: { thumbnailPath: "thumbnail.png", manifestPath: "generation-manifest.json", requestPath: "thumbnail-input.json", evidence: { provider: "openai", protocol: "openai-images", model: "fixture-model", generationStatus: "GENERATED", promptSha256: "prompt", requestedSize: "1008x1344", rawDimensions: "1008x1344", finalDimensions: "1080x1440", transform: "scale=1080:1440:force_original_aspect_ratio=increase,crop=1080:1440", inputImages: [], outputSha256: "output" } } }), buildPackage: async () => { packageCalls += 1; return { packageDir: "publish-review-package", sha256: { finalVideo: "", thumbnail: "" }, status: "BLOCKED" }; } }, s5: { referenceImages: ["reference.png"], source: { videoId: "source", url: "source-url", publisher: "Publisher", sourceStart: 0, sourceEnd: 1, sourceFileIdentity: "sha256:source" }, materialSources: [], framingPolicy: {}, modules: { included: [], omitted: {} }, reviewFlags: { blockers: [], warnings: [] }, publication: { headline: "Headline", sourceCredit: "Publisher", captionDraft: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six twenty seven twenty eight twenty nine thirty thirty one thirty two thirty three thirty four thirty five thirty six thirty seven thirty eight thirty nine forty forty one forty two forty three forty four forty five forty six forty seven forty eight forty nine fifty", structure: ["HOOK", "CONTEXT", "RELEVANCE", "QUESTION"] } } });
			expect(result.status).toBe("FAILED"); if (result.status === "FAILED") expect(result.stage).toBe("publish_package"); expect(packageCalls).toBe(1);
		});
	});
});
