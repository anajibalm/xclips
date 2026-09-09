import { describe, it, expect, beforeEach } from "bun:test";
import { runAutoProductionPlanning, AutoProductionDeps } from "@/lib/xclips/auto-production-orchestrator";
import {
  ProductionBrief,
  AccountPreset,
} from "@/lib/xclips/auto-production-types";
import { XclipsProject, XclipsTranscript, XclipsClip, Result } from "@/lib/xclips/types";

// --- Mock Data ------------------------------------------------------------

const mockProject: XclipsProject = {
  id: "proj_test_001",
  name: "Test Video",
  sourceType: "local",
  sourcePath: "/tmp/test-video.mp4",
  durationSec: 120,
  width: 1920,
  height: 1080,
  frameRate: 30,
  isVfr: false,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const mockTranscript: XclipsTranscript = {
  id: "tr_test_001",
  projectId: "proj_test_001",
  label: "AI Generated Subtitles",
  sourceType: "ai",
  isActive: true,
  language: "id",
  rawText: "Ini adalah transkrip uji untuk video berita erupsi gunung berapi yang terjadi hari ini",
  words: [
    { word: "Ini", start: 0, end: 0.5 },
    { word: "adalah", start: 0.5, end: 1.0 },
    { word: "transkrip", start: 1.0, end: 1.8 },
    { word: "uji", start: 1.8, end: 2.2 },
    { word: "untuk", start: 2.2, end: 2.6 },
    { word: "video", start: 2.6, end: 3.1 },
    { word: "berita", start: 3.1, end: 3.6 },
    { word: "erupsi", start: 3.6, end: 4.2 },
    { word: "gunung", start: 4.2, end: 4.7 },
    { word: "berapi", start: 4.7, end: 5.3 },
    { word: "yang", start: 5.3, end: 5.5 },
    { word: "terjadi", start: 5.5, end: 6.1 },
    { word: "hari", start: 6.1, end: 6.4 },
    { word: "ini", start: 6.4, end: 6.8 },
  ],
  srtContent: "",
  createdAt: "2026-09-07T00:00:00.000Z",
};

const mockHighlight: XclipsClip = {
  id: "clip_test_001",
  projectId: "proj_test_001",
  title: "Dampak Erupsi Anak Krakatau",
  hookText: "Erupsi besar terjadi hari ini",
  viralScore: 85,
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
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
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

function makeValidBrief(overrides?: Partial<ProductionBrief>): ProductionBrief {
  return {
    source: { sourcePath: "/tmp/test-video.mp4", sourceType: "local" },
    editorialAngle: "Dampak erupsi Anak Krakatau terhadap warga sekitar",
    editorialFunction: "Public communication / information integrity",
    accountPresetId: "shadow",
    sourceName: "TVRI Nasional",
    sourceDate: "2026-09-07",
    accountHandle: "@tvrinasional",
    sourceRole: "TV Broadcast",
    brollPool: [{ assetId: "broll_001", path: "/tmp/broll1.mp4" }],
    ...overrides,
  };
}

// --- Tests ----------------------------------------------------------------

describe("xclips - Auto Production Orchestrator (Slice 2)", () => {
  describe("Happy path", () => {
    it("valid brief produces structured planning result", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(makeValidBrief(), deps);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.brief).toBeDefined();
        expect(result.preset).toBeDefined();
        expect(result.preset.id).toBe("shadow");
        expect(result.project.id).toBe("proj_test_001");
        expect(result.transcript.id).toBe("tr_test_001");
        expect(result.editPlan).toBeDefined();
        expect(result.editPlan.statementStart).toBe(10);
        expect(result.editPlan.statementEnd).toBe(45);
        expect(result.editPlan.headline).toBe("Dampak Erupsi Anak Krakatau");
        expect(result.editPlan.brollPlacements).toEqual([]);
        expect(result.editPlan.statementSignal.confidence).toBe("strong");
        expect(result.editPlan.brollSignal.confidence).toBe("strong");
        expect(result.editPlan.headlineSignal.confidence).toBe("strong");
      }
    });

    it("passes editorialAngle to discoverHighlights as topicPrompt", async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const deps = makeMockDeps({
        discoverHighlights: async (_id: string, options?: Record<string, unknown>) => {
          capturedOptions = options;
          return { success: true, data: [mockHighlight] };
        },
      });

      const angle = "Respons pemerintah terhadap dampak erupsi";
      await runAutoProductionPlanning(makeValidBrief({ editorialAngle: angle }), deps);

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions!.topicPrompt).toBe(angle);
      expect(capturedOptions!.targetDuration).toBe("short");
    });

    it("passes editorialFunction to discoverHighlights as planning context", async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const deps = makeMockDeps({
        discoverHighlights: async (_id: string, options?: Record<string, unknown>) => {
          capturedOptions = options;
          return { success: true, data: [mockHighlight] };
        },
      });

      const fn = "Humanization";
      await runAutoProductionPlanning(makeValidBrief({ editorialFunction: fn }), deps);

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions!.editorialFunction).toBe(fn);
      // hookFormula stays untouched by Auto Production planning
      expect(capturedOptions!.hookFormula).toBeUndefined();
    });

    it("resolves kabakom preset correctly", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(
        makeValidBrief({ accountPresetId: "kabakom" }),
        deps,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.preset.id).toBe("kabakom");
        expect(result.preset.label).toBe("Kabakom");
      }
    });
  });

  describe("Invalid brief / preset", () => {
    it("invalid brief fails safely", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(
        { source: { sourcePath: "", sourceType: "local" } } as ProductionBrief,
        deps,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_brief");
        expect(result.error).toContain("Invalid brief");
      }
    });

    it("invalid preset fails safely at brief validation", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(
        makeValidBrief({ accountPresetId: "nonexistent" as any }),
        deps,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_brief");
        expect(result.error).toContain("Invalid brief");
      }
    });

    it("missing editorialAngle blocks validation", async () => {
      const deps = makeMockDeps();
      const brief = makeValidBrief();
      delete (brief as Record<string, unknown>).editorialAngle;
      const result = await runAutoProductionPlanning(brief, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_brief");
      }
    });

    it("missing editorialFunction blocks validation", async () => {
      const deps = makeMockDeps();
      const brief = makeValidBrief();
      delete (brief as Record<string, unknown>).editorialFunction;
      const result = await runAutoProductionPlanning(brief, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_brief");
      }
    });

    it("missing sourceName blocks validation", async () => {
      const deps = makeMockDeps();
      const brief = makeValidBrief();
      delete (brief as Record<string, unknown>).sourceName;
      const result = await runAutoProductionPlanning(brief, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_brief");
      }
    });

    it("missing accountHandle blocks validation", async () => {
      const deps = makeMockDeps();
      const brief = makeValidBrief();
      delete (brief as Record<string, unknown>).accountHandle;
      const result = await runAutoProductionPlanning(brief, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("validate_brief");
      }
    });
  });

  describe("Missing sourceDate", () => {
    it("missing sourceDate does not fail", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(
        makeValidBrief({ sourceDate: undefined }),
        deps,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Statement selection", () => {
    it("selected statement under 30s proceeds with review signal (no filler added)", async () => {
      const tooShort: XclipsClip = {
        ...mockHighlight,
        startSec: 10,
        endSec: 35, // 25s < 30s
      };
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [tooShort] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) {
        // Exact statement bounds preserved — nothing stretched to reach 30s
        expect(result.editPlan.statementStart).toBe(10);
        expect(result.editPlan.statementEnd).toBe(35);
        expect(result.editPlan.statementSignal.confidence).toBe("review");
        expect(result.editPlan.statementSignal.warnings.join(" ")).toContain("25.0s");
        expect(result.editPlan.statementSignal.warnings.join(" ")).toContain("no filler added");
      }
    });

    it("extends endpoint to nearest transcript sentence closure within ceiling", async () => {
      const deps = makeMockDeps({
        getExistingTranscript: async () => ({ success: true, data: { ...mockTranscript, words: [
          { word: "Awal", start: 0, end: 10 },
          { word: "lanjut", start: 10, end: 35 },
          { word: "selesai.", start: 35, end: 43 },
        ] } }),
        discoverHighlights: async () => ({ success: true, data: [{ ...mockHighlight, startSec: 0, endSec: 35 }] }),
      });
      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) expect(result.editPlan.statementEnd).toBe(43);
    });

    it("malformed zero-span statement still fails technically", async () => {
      const zeroSpan: XclipsClip = {
        ...mockHighlight,
        startSec: 10,
        endSec: 10,
      };
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [zeroSpan] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("select_statement");
        expect(result.error).toContain("malformed bounds");
      }
    });

    it("selected statement over 60s is rejected", async () => {
      const tooLong: XclipsClip = {
        ...mockHighlight,
        startSec: 0,
        endSec: 120, // 120s > 60s
      };
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [tooLong] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("select_statement");
        expect(result.error).toContain("outside target range");
      }
    });

    it("no numeric confidence thresholds are encoded — very low score still yields strong", async () => {
      const lowViralScore: XclipsClip = {
        ...mockHighlight,
        viralScore: 1, // minimal score
        startSec: 10,
        endSec: 45,
      };
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [lowViralScore] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.editPlan.statementSignal.confidence).toBe("strong");
        expect(result.editPlan.statementSignal.warnings).toEqual([]);
      }
    });

    it("no numeric confidence thresholds are encoded — score of 0 still yields strong", async () => {
      const zeroScore: XclipsClip = {
        ...mockHighlight,
        viralScore: 0,
        startSec: 10,
        endSec: 45,
      };
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [zeroScore] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.editPlan.statementSignal.confidence).toBe("strong");
        expect(result.editPlan.statementSignal.warnings).toEqual([]);
      }
    });

    it("picks highest-scored candidate when multiple exist", async () => {
      const lowScore: XclipsClip = {
        ...mockHighlight,
        id: "clip_low",
        viralScore: 30,
        startSec: 15,
        endSec: 50,
      };
      const highScore: XclipsClip = {
        ...mockHighlight,
        id: "clip_high",
        viralScore: 95,
        startSec: 20,
        endSec: 55,
      };

      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [lowScore, highScore] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.editPlan.statementStart).toBe(20);
        expect(result.editPlan.statementEnd).toBe(55);
      }
    });

    it("fails when no highlights returned", async () => {
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: true, data: [] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("select_statement");
        expect(result.error).toContain("No suitable statement");
      }
    });

    it("fails when discoverHighlights returns error", async () => {
      const deps = makeMockDeps({
        discoverHighlights: async () => ({ success: false, error: "AI provider timeout" }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("select_statement");
        expect(result.error).toBe("AI provider timeout");
      }
    });

    it("start guard moves raw AI start backward to sentence boundary", async () => {
      // Transcript: sentence 1 ends at "selesai." (end 20), sentence 2 runs 20-50.
      // AI selects startSec=30 (mid-sentence 2). Guard must move it to 20 (end of sentence 1).
      const wordsWithBoundary = [
        { word: "Pembukaan", start: 0, end: 5 },
        { word: "pidato", start: 5, end: 8 },
        { word: "selesai.", start: 8, end: 20 },
        { word: "Kita", start: 20, end: 22 },
        { word: "harus", start: 22, end: 24 },
        { word: "siap", start: 24, end: 26 },
        { word: "menghadapi", start: 26, end: 28 },
        { word: "situasi", start: 28, end: 30 },
        { word: "darurat.", start: 30, end: 35 },
      ];
      const clipWithMidStart: XclipsClip = {
        ...mockHighlight,
        startSec: 30, // raw AI start — inside sentence 2
        endSec: 35,
      };
      const deps = makeMockDeps({
        getExistingTranscript: async () => ({
          success: true,
          data: { ...mockTranscript, words: wordsWithBoundary },
        }),
        discoverHighlights: async () => ({ success: true, data: [clipWithMidStart] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) {
        // Guard must have moved start backward to the sentence boundary (end of "selesai." = 20)
        expect(result.editPlan.statementStart).toBe(20);
        expect(result.editPlan.statementStart).toBeLessThan(30);
        // End guard still works
        expect(result.editPlan.statementEnd).toBe(35);
        // Headline unchanged
        expect(result.editPlan.headline).toBe("Dampak Erupsi Anak Krakatau");
      }
    });

    it("start guard does not move start forward", async () => {
      // AI start is already at a sentence boundary — guard must not advance it.
      const wordsAtBoundary = [
        { word: "Awal.", start: 0, end: 10 },
        { word: "Mulai", start: 10, end: 12 },
        { word: "sekarang.", start: 12, end: 20 },
      ];
      const clipAtBoundary: XclipsClip = {
        ...mockHighlight,
        startSec: 10, // already at sentence boundary
        endSec: 20,
      };
      const deps = makeMockDeps({
        getExistingTranscript: async () => ({
          success: true,
          data: { ...mockTranscript, words: wordsAtBoundary },
        }),
        discoverHighlights: async () => ({ success: true, data: [clipAtBoundary] }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.editPlan.statementStart).toBe(10);
      }
    });

    it("start guard does not add an additional AI call", async () => {
      let aiCallCount = 0;
      const deps = makeMockDeps({
        discoverHighlights: async () => { aiCallCount++; return { success: true, data: [mockHighlight] }; },
      });

      await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(aiCallCount).toBe(1);
    });
  });

  describe("B-roll pool", () => {
    it("empty B-roll pool produces empty brollPlacements", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(
        makeValidBrief({ brollPool: [] }),
        deps,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.editPlan.brollPlacements).toEqual([]);
      }
    });

    it("B-roll pool exists but placements are deferred (empty for now)", async () => {
      const deps = makeMockDeps();
      const result = await runAutoProductionPlanning(
        makeValidBrief({
          brollPool: [
            { assetId: "b1", path: "/tmp/broll1.mp4" },
            { assetId: "b2", path: "/tmp/broll2.mp4" },
          ],
        }),
        deps,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.editPlan.brollPlacements).toEqual([]);
        expect(result.editPlan.brollSignal.confidence).toBe("strong");
      }
    });
  });

  describe("Source preparation failures", () => {
    it("ingest failure returns structured error", async () => {
      const deps = makeMockDeps({
        ingestLocalFile: async () => ({ success: false, error: "File not found: /tmp/missing.mp4" }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("prepare_source");
        expect(result.error).toContain("File not found");
      }
    });

    it("ingest throw returns structured error", async () => {
      const deps = makeMockDeps({
        ingestLocalFile: async () => { throw new Error("Disk I/O error"); },
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("prepare_source");
        expect(result.error).toContain("Disk I/O error");
      }
    });
  });

  describe("Transcription failures", () => {
    it("transcription failure returns structured error", async () => {
      const deps = makeMockDeps({
        transcribeProject: async () => ({ success: false, error: "API key not configured" }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("transcribe");
        expect(result.error).toBe("API key not configured");
      }
    });

    it("empty transcript words returns structured error", async () => {
      const deps = makeMockDeps({
        transcribeProject: async () => ({
          success: true,
          data: { ...mockTranscript, words: [] },
        }),
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe("transcribe");
        expect(result.error).toContain("no usable words");
      }
    });

    it("reuses existing transcript with words without calling transcribeProject", async () => {
      let transcribeCalled = false;
      const deps = makeMockDeps({
        getExistingTranscript: async () => ({ success: true, data: mockTranscript }),
        transcribeProject: async () => {
          transcribeCalled = true;
          return { success: true, data: mockTranscript };
        },
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      expect(transcribeCalled).toBe(false);
      if (result.success) {
        expect(result.transcript.id).toBe("tr_test_001");
      }
    });
  });

  describe("Existing source/project reuse", () => {
    const existingProject: XclipsProject = {
      ...mockProject,
      id: "proj_existing_001",
      name: "Metro TV",
    };

    it("reuses the persisted project + transcript without ingesting or transcribing", async () => {
      let localIngestCalled = false;
      let ytIngestCalled = false;
      let transcribeCalled = false;
      let planningCalled = false;
      const deps = makeMockDeps({
        findExistingProjectBySourcePath: async () => ({ success: true, data: existingProject }),
        ingestLocalFile: async () => { localIngestCalled = true; return { success: true, data: mockProject }; },
        ingestYouTubeUrl: async () => { ytIngestCalled = true; return { success: true, data: mockProject }; },
        getExistingTranscript: async () => ({ success: true, data: mockTranscript }),
        transcribeProject: async () => { transcribeCalled = true; return { success: true, data: mockTranscript }; },
        discoverHighlights: async () => { planningCalled = true; return { success: true, data: [mockHighlight] }; },
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      expect(localIngestCalled).toBe(false);
      expect(ytIngestCalled).toBe(false);
      expect(transcribeCalled).toBe(false);
      expect(planningCalled).toBe(true);
      if (result.success) {
        expect(result.project.id).toBe("proj_existing_001");
        expect(result.transcript.id).toBe("tr_test_001");
        expect(result.editPlan.statementStart).toBe(10);
        expect(result.editPlan.statementEnd).toBe(45);
      }
    });

    it("falls through to ingest when no existing project matches", async () => {
      let localIngestCalled = false;
      const deps = makeMockDeps({
        findExistingProjectBySourcePath: async () => ({ success: true, data: null }),
        ingestLocalFile: async () => { localIngestCalled = true; return { success: true, data: mockProject }; },
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      expect(localIngestCalled).toBe(true);
    });

    it("falls through to ingest when the finder reports failure", async () => {
      let localIngestCalled = false;
      const deps = makeMockDeps({
        findExistingProjectBySourcePath: async () => ({ success: false, error: "db unavailable" }),
        ingestLocalFile: async () => { localIngestCalled = true; return { success: true, data: mockProject }; },
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      expect(localIngestCalled).toBe(true);
    });

    it("falls through to ingest when the finder throws", async () => {
      let localIngestCalled = false;
      const deps = makeMockDeps({
        findExistingProjectBySourcePath: async () => { throw new Error("db boom"); },
        ingestLocalFile: async () => { localIngestCalled = true; return { success: true, data: mockProject }; },
      });

      const result = await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(result.success).toBe(true);
      expect(localIngestCalled).toBe(true);
    });
  });

  describe("Backward compatibility", () => {
    it("does not call ingestYouTubeUrl for local sources", async () => {
      let ytCalled = false;
      const deps = makeMockDeps({
        ingestYouTubeUrl: async () => { ytCalled = true; return { success: true, data: mockProject }; },
      });

      await runAutoProductionPlanning(makeValidBrief(), deps);
      expect(ytCalled).toBe(false);
    });

    it("calls ingestYouTubeUrl for url sources", async () => {
      let ytCalled = false;
      const deps = makeMockDeps({
        ingestYouTubeUrl: async () => { ytCalled = true; return { success: true, data: mockProject }; },
      });

      await runAutoProductionPlanning(
        makeValidBrief({ source: { sourcePath: "https://youtube.com/watch?v=test", sourceType: "url" } }),
        deps,
      );
      expect(ytCalled).toBe(true);
    });
  });
});
