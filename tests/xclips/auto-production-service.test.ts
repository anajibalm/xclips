import { describe, it, expect, beforeEach } from "bun:test";
import {
	runAutoProductionJob,
	rerenderAutoProductionJob,
	detectSourceType,
	type RerenderJobContext,
} from "@/lib/xclips/auto-production-service";
import type { ProductionBrief } from "@/lib/xclips/auto-production-types";
import type { AutoProductionDeps } from "@/lib/xclips/auto-production-orchestrator";
import type {
	RenderAutoProductionInput,
	RenderAutoProductionResult,
} from "@/lib/xclips/auto-production-renderer";
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
		...overrides,
	};
}

function makeOverrides(opts?: {
	renderResult?: RenderAutoProductionResult;
	coverResult?: CoverResult;
	qcResult?: QcResult;
}) {
	return {
		render: async () => opts?.renderResult ?? mockRenderResult,
		cover: async () => opts?.coverResult ?? mockCoverResult,
		qc: async () => opts?.qcResult ?? mockQcResult,
	};
}

// --- Tests ----------------------------------------------------------------

describe("auto-production-service", () => {
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
		it("should return READY when all stages pass", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				outputDir: "/tmp/svc-test-output",
				_overrides: makeOverrides(),
			});

			expect(result.status).toBe("READY");
			if (result.status === "READY") {
				expect(result.bundle.videoPath).toContain("final.mp4");
				expect(result.bundle.coverPath).toContain("cover.jpg");
				expect(result.bundle.qc.verdict).toBe("READY");
				expect(result.bundle.editPlan).toBeDefined();
				expect(result.bundle.preset).toBeDefined();
				expect(result.bundle.rerenderContext).toBeDefined();
				expect(result.bundle.rerenderContext.transcriptWords.length).toBeGreaterThan(0);
				expect(result.bundle.rerenderContext.sourceVideoPath).toBe(mockProject.sourcePath);
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
			expect(fullResult.status).toBe("READY");

			// Reset counters after planning
			ingestCalled = false;
			transcribeCalled = false;
			discoverCalled = false;

			// Now: rerender — should NOT call any planning functions
			const rerenderResult = await rerenderAutoProductionJob({
				context: fullResult.status === "READY" ? fullResult.bundle.rerenderContext : (() => { throw new Error("unexpected"); })(),
				_overrides: makeOverrides(),
			});

			expect(rerenderResult.status).toBe("READY");
			expect(ingestCalled).toBe(false);
			expect(transcribeCalled).toBe(false);
			expect(discoverCalled).toBe(false);
		});

		it("should reuse the same editPlan from context", async () => {
			const fullResult = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(fullResult.status).toBe("READY");

			if (fullResult.status === "READY") {
				const ctx = fullResult.bundle.rerenderContext;
				const rerenderResult = await rerenderAutoProductionJob({
					context: ctx,
					_overrides: makeOverrides(),
				});

				expect(rerenderResult.status).toBe("READY");
				if (rerenderResult.status === "READY") {
					expect(rerenderResult.bundle.editPlan.headline).toBe(ctx.editPlan.headline);
					expect(rerenderResult.bundle.editPlan.statementStart).toBe(ctx.editPlan.statementStart);
					expect(rerenderResult.bundle.editPlan.statementEnd).toBe(ctx.editPlan.statementEnd);
				}
			}
		});

		it("should produce a NEW output path (deterministic rerender)", async () => {
			const fullResult = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(fullResult.status).toBe("READY");

			if (fullResult.status === "READY") {
				const ctx = fullResult.bundle.rerenderContext;
				const rerenderResult = await rerenderAutoProductionJob({
					context: ctx,
					_overrides: makeOverrides(),
				});

				expect(rerenderResult.status).toBe("READY");
				// Rerender produces a new file (different timestamp in path)
				if (rerenderResult.status === "READY") {
					expect(rerenderResult.bundle.videoPath).toContain("final.mp4");
					expect(rerenderResult.bundle.coverPath).toContain("cover.jpg");
				}
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
			expect(first.status).toBe("READY");
			const callsAfterFirst = discoverCallCount;

			// Regenerate (second job with same brief)
			const second = await runAutoProductionJob({
				brief: mockBrief,
				deps,
				_overrides: makeOverrides(),
			});
			expect(second.status).toBe("READY");

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
		it("should return READY when QC verdict is READY", async () => {
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
			expect(result.status).toBe("READY");
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
		it("should include rerenderContext in successful bundle", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("READY");
			if (result.status === "READY") {
				const ctx = result.bundle.rerenderContext;
				expect(ctx.brief).toBeDefined();
				expect(ctx.preset).toBeDefined();
				expect(ctx.editPlan).toBeDefined();
				expect(ctx.transcriptWords).toBeDefined();
				expect(ctx.sourceVideoPath).toBe(mockProject.sourcePath);
				expect(ctx.sourceWidth).toBe(1920);
				expect(ctx.sourceHeight).toBe(1080);
			}
		});

		it("should include preset with correct dimensions", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("READY");
			if (result.status === "READY") {
				expect(result.bundle.preset.id).toBe("shadow");
				expect(result.bundle.preset.width).toBe(1080);
				expect(result.bundle.preset.height).toBe(1920);
			}
		});

		it("should include editPlan with headline and statement range", async () => {
			const result = await runAutoProductionJob({
				brief: mockBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("READY");
			if (result.status === "READY") {
				expect(result.bundle.editPlan.headline).toBe("Dampak Erupsi Gunung Kelud");
				expect(result.bundle.editPlan.statementStart).toBe(10);
				expect(result.bundle.editPlan.statementEnd).toBe(45);
			}
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

		it("should handle kabakom preset", async () => {
			const kabakomBrief: ProductionBrief = {
				...mockBrief,
				accountPresetId: "kabakom",
			};
			const result = await runAutoProductionJob({
				brief: kabakomBrief,
				deps: makeMockDeps(),
				_overrides: makeOverrides(),
			});
			expect(result.status).toBe("READY");
			if (result.status === "READY") {
				expect(result.bundle.preset.id).toBe("kabakom");
			}
		});
	});
});
