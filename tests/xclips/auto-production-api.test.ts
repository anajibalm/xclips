import { describe, it, expect } from "bun:test";
import {
	buildAutoProductionBrief,
	type BuildAutoProductionBriefInput,
	type AutoProductionJobResult,
	type RerenderJobContext,
} from "@/lib/xclips/auto-production-api";

// ============================================================
// Auto Production Client API Tests — Client/Server Boundary
// ============================================================

describe("auto-production-api (client-safe)", () => {
	// --- buildAutoProductionBrief --------------------------------------------

	describe("buildAutoProductionBrief", () => {
		const validInput: BuildAutoProductionBriefInput = {
			sourcePath: "/tmp/video.mp4",
			editorialAngle: "Focus on main speaker",
			editorialFunction: "Humanization",
			accountPresetId: "shadow",
			sourceName: "test-clip",
			accountHandle: "@testaccount",
		};

		it("should produce local brief for local path", () => {
			const brief = buildAutoProductionBrief(validInput);
			expect(brief.source.sourceType).toBe("local");
			expect(brief.source.sourcePath).toBe("/tmp/video.mp4");
		});

		it("should produce url brief for YouTube URL", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				sourcePath: "https://www.youtube.com/watch?v=abc123",
			});
			expect(brief.source.sourceType).toBe("url");
		});

		it("should produce url brief for youtu.be short URL", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				sourcePath: "https://youtu.be/abc123",
			});
			expect(brief.source.sourceType).toBe("url");
		});

		it("should produce url brief for YouTube shorts URL", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				sourcePath: "https://youtube.com/shorts/abc123",
			});
			expect(brief.source.sourceType).toBe("url");
		});

		it("should always have brollPool=[]", () => {
			const brief = buildAutoProductionBrief(validInput);
			expect(brief.brollPool).toEqual([]);
		});

		it("should trim whitespace from sourcePath", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				sourcePath: "  /tmp/video.mp4  ",
			});
			expect(brief.source.sourcePath).toBe("/tmp/video.mp4");
		});

		it("should trim whitespace from editorialAngle", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				editorialAngle: "  Focus on speaker  ",
			});
			expect(brief.editorialAngle).toBe("Focus on speaker");
		});

		it("should handle optional sourceDate omitted", () => {
			const brief = buildAutoProductionBrief(validInput);
			expect(brief.sourceDate).toBeUndefined();
		});

		it("should pass through optional sourceDate", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				sourceDate: "2026-09-01",
			});
			expect(brief.sourceDate).toBe("2026-09-01");
		});

		it("should handle optional sourceRole omitted", () => {
			const brief = buildAutoProductionBrief(validInput);
			expect(brief.sourceRole).toBeUndefined();
		});

		it("should pass through optional sourceRole", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				sourceRole: "interviewee",
			});
			expect(brief.sourceRole).toBe("interviewee");
		});

		it("should pass through editorialFunction trimmed", () => {
			const brief = buildAutoProductionBrief({
				...validInput,
				editorialFunction: "  Accountability  ",
			});
			expect(brief.editorialFunction).toBe("Accountability");
		});

		it("should default sensitiveContent to false and pass through true", () => {
			expect(buildAutoProductionBrief(validInput).sensitiveContent).toBe(false);
			const flagged = buildAutoProductionBrief({
				...validInput,
				sensitiveContent: true,
			});
			expect(flagged.sensitiveContent).toBe(true);
		});
	});

	// --- Serializability of RerenderJobContext --------------------------------

	describe("RerenderJobContext serializability", () => {
		it("should round-trip through JSON (no functions, no circular refs)", () => {
			const context: RerenderJobContext = {
				brief: {
					source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
					editorialAngle: "Focus",
					editorialFunction: "Humanization",
					accountPresetId: "shadow",
					sourceName: "clip",
					accountHandle: "@test",
					brollPool: [],
				},
				preset: { id: "shadow", label: "Shadow" },
				editPlan: {
					statementStart: 10,
					statementEnd: 40,
					headline: "Main Speaker",
					brollPlacements: [],
					statementSignal: { confidence: "strong", warnings: [] },
					brollSignal: { confidence: "low", warnings: ["No broll assets"] },
					headlineSignal: { confidence: "strong", warnings: [] },
				},
				transcriptWords: [
					{ word: "Hello", start: 0, end: 0.5 },
					{ word: "world", start: 0.5, end: 1.0 },
				],
				sourceVideoPath: "/tmp/v.mp4",
				sourceWidth: 1920,
				sourceHeight: 1080,
			};

			const serialized = JSON.stringify(context);
			const deserialized = JSON.parse(serialized) as RerenderJobContext;

			expect(deserialized.brief.source.sourcePath).toBe("/tmp/v.mp4");
			expect(deserialized.editPlan.statementStart).toBe(10);
			expect(deserialized.transcriptWords).toHaveLength(2);
			expect(deserialized.sourceWidth).toBe(1920);
		});
	});

	// --- Serializability of AutoProductionJobResult ---------------------------

	describe("AutoProductionJobResult serializability", () => {
		const makeReadyResult = (): AutoProductionJobResult => ({
			status: "READY",
			bundle: {
				videoPath: "/out/video.mp4",
				coverPath: "/out/cover.jpg",
				qc: { passedCount: 15, reviewCount: 0, failedCount: 1 },
				editPlan: {
					statementStart: 10,
					statementEnd: 40,
					headline: "Main",
					statementSignal: { confidence: "strong", warnings: [] },
				},
				preset: { id: "shadow", label: "Shadow", width: 1080, height: 1920, fps: 30 },
				rerenderContext: {
					brief: {
						source: { sourcePath: "/tmp/v.mp4", sourceType: "local" },
						editorialAngle: "Focus",
						editorialFunction: "Humanization",
						accountPresetId: "shadow",
						sourceName: "clip",
						accountHandle: "@test",
						brollPool: [],
					},
					preset: { id: "shadow", label: "Shadow" },
					editPlan: {
						statementStart: 10,
						statementEnd: 40,
						headline: "Main",
						brollPlacements: [],
						statementSignal: { confidence: "strong", warnings: [] },
						brollSignal: { confidence: "low", warnings: [] },
						headlineSignal: { confidence: "strong", warnings: [] },
					},
					transcriptWords: [],
					sourceVideoPath: "/tmp/v.mp4",
					sourceWidth: 1920,
					sourceHeight: 1080,
				},
			},
		});

		it("should round-trip READY result through JSON", () => {
			const result = makeReadyResult();
			const serialized = JSON.stringify(result);
			const deserialized = JSON.parse(serialized) as AutoProductionJobResult;
			expect(deserialized.status).toBe("READY");
		});

		it("should round-trip FAILED result through JSON", () => {
			const result: AutoProductionJobResult = {
				status: "FAILED",
				stage: "rendering",
				error: "FFmpeg error",
			};
			const serialized = JSON.stringify(result);
			const deserialized = JSON.parse(serialized) as AutoProductionJobResult;
			expect(deserialized.status).toBe("FAILED");
		});

		it("should round-trip NEEDS_REVIEW result through JSON", () => {
			const result: AutoProductionJobResult = {
				status: "NEEDS_REVIEW",
				bundle: makeReadyResult().bundle,
				reasons: ["Missing sourceDate"],
			};
			const serialized = JSON.stringify(result);
			const deserialized = JSON.parse(serialized) as AutoProductionJobResult;
			expect(deserialized.status).toBe("NEEDS_REVIEW");
		});
	});
});
