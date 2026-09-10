import { describe, it, expect } from "bun:test";
import {
  runAutoProductionPlanning,
  type AutoProductionDeps,
} from "@/lib/xclips/auto-production-orchestrator";
import type { ProductionBrief } from "@/lib/xclips/auto-production-types";
import type { XclipsClip, XclipsTranscript, WordTimestamp } from "@/lib/xclips/types";
import { selectClipWords } from "@/lib/xclips/auto-production-renderer";

// ============================================================
// S1.3 — headline input isolation architecture tests.
// Synthetic transcript: moment planner sees the FULL text, but the
// dedicated headline call must receive ONLY the final clip slice.
// ============================================================

const FULL_TEXT =
  "A government discussed helicopters and equipment. " +
  "Later the speaker said delays were noted and future steps must be anticipatory.";

function wordsWithTimes(text: string, startAt: number): WordTimestamp[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  return tokens.map((word, i) => ({
    word,
    start: startAt + i * 0.5,
    end: startAt + i * 0.5 + 0.4,
  }));
}

const fullWords: WordTimestamp[] = wordsWithTimes(FULL_TEXT, 0);
// Sentence 2 ("Later ... anticipatory.") starts at word index 6 → t=3.0.
const CLIP_START = 3.0;
const CLIP_END = 3.0 + (fullWords.length - 6) * 0.5;

const mockTranscript: XclipsTranscript = {
  id: "tr_iso",
  projectId: "proj_iso",
  language: "en",
  rawText: FULL_TEXT,
  srtContent: "",
  words: fullWords,
  createdAt: "2026-09-07T00:00:00.000Z",
};

const mockProject = {
  id: "proj_iso",
  name: "Isolation Video",
  sourceType: "local" as const,
  sourcePath: "/tmp/iso.mp4",
  durationSec: 60,
  width: 1920,
  height: 1080,
  frameRate: 30,
  isVfr: false,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const momentClip: XclipsClip = {
  id: "clip_iso",
  projectId: "proj_iso",
  title: "Moment Title Sees Full Transcript",
  hookText: "hook",
  viralScore: 90,
  startSec: CLIP_START,
  endSec: CLIP_END,
  layoutMode: "blur_bg",
  panOffsetX: 0,
  subtitleStyle: undefined as never,
  removeFillers: false,
  removeSilence: false,
  customCuts: [],
  status: "draft",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const brief: ProductionBrief = {
  source: { sourcePath: "/tmp/iso.mp4", sourceType: "local" },
  editorialAngle: "response steps",
  editorialFunction: "Public communication",
  accountPresetId: "shadow",
  sourceName: "Iso TV",
  accountHandle: "@iso",
  brollPool: [],
};

function makeDeps(
  onHeadline: (input: { selectedText: string; speaker?: string; publisher?: string }) => void,
  counters: { discover: number; headline: number },
  headlineResult: { success: true; data: { headline: string } } | { success: false; error: string } = {
    success: true,
    data: { headline: "Delays Noted As Steps Turn Anticipatory" },
  },
): AutoProductionDeps {
  return {
    ingestLocalFile: async () => ({ success: true, data: { ...mockProject } }),
    ingestYouTubeUrl: async () => ({ success: false, error: "unused" }),
    getExistingTranscript: async () => ({ success: true, data: mockTranscript }),
    transcribeProject: async () => ({ success: false, error: "unused" }),
    discoverHighlights: async () => {
      counters.discover++;
      return { success: true, data: [{ ...momentClip }] };
    },
    generateHeadline: async (input) => {
      counters.headline++;
      onHeadline(input);
      return headlineResult;
    },
  };
}

describe("xclips - S1.3 headline input isolation", () => {
  it("1-2. headline input contains ONLY the final clip slice", async () => {
    let seen = "";
    const counters = { discover: 0, headline: 0 };
    const deps = makeDeps((input) => { seen = input.selectedText; }, counters);
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    expect(seen).not.toContain("helicopters");
    expect(seen).not.toContain("equipment");
    expect(seen.toLowerCase()).toContain("delays were noted");
    expect(seen.toLowerCase()).toContain("anticipatory");
  });

  it("3. guarded bounds are applied before the headline call", async () => {
    // findStartBoundary walks back to sentence end; clip start is already
    // at "Later" (t=3.0) following "equipment." (ends t=3.0) → unchanged.
    let seen = "";
    const counters = { discover: 0, headline: 0 };
    const deps = makeDeps((input) => { seen = input.selectedText; }, counters);
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.editPlan.statementStart).toBeLessThanOrEqual(CLIP_START);
      const selectedInBounds = selectClipWords(
        fullWords,
        result.editPlan.statementStart,
        result.editPlan.statementEnd,
      );
      expect(seen).toBe(
        selectedInBounds.map((w) => w.word).join(" ").replace(/\s+/g, " ").trim(),
      );
    }
  });

  it("rejects a later transcript word with a backward-overlapping timestamp", async () => {
    let seen = "";
    const counters = { discover: 0, headline: 0 };
    const words: WordTimestamp[] = [
      { word: "A", start: 0, end: 1 },
      { word: "B", start: 1, end: 2 },
      { word: "C", start: 2, end: 3 },
      { word: "D", start: 1.5, end: 2.5 },
    ];
    const transcript = { ...mockTranscript, words };
    const deps = {
      ...makeDeps((input) => { seen = input.selectedText; }, counters),
      getExistingTranscript: async () => ({ success: true as const, data: transcript }),
      discoverHighlights: async () => ({
        success: true as const,
        data: [{ ...momentClip, startSec: 0, endSec: 2 }],
      }),
    };
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    expect(seen).toBe("A B");
    expect(seen).not.toContain("D");
  });

  it("4. verified publisher metadata is passed separately, not as transcript", async () => {
    let publisher: string | undefined;
    const counters = { discover: 0, headline: 0 };
    const deps: AutoProductionDeps = {
      ...makeDeps(() => {}, counters),
      ingestLocalFile: async () => ({
        success: true,
        data: { ...mockProject, sourceMeta: { channel: "Iso Channel" } },
      }),
    };
    const wrapped: AutoProductionDeps = {
      ...deps,
      generateHeadline: async (input) => {
        counters.headline++;
        publisher = input.publisher;
        return { success: true, data: { headline: "Delays Noted As Steps Turn Anticipatory" } };
      },
    };
    const result = await runAutoProductionPlanning(brief, wrapped);
    expect(result.success).toBe(true);
    expect(publisher).toBe("Iso Channel");
  });

  it("5-6. exactly 1 moment call + 1 headline call, no third AI call", async () => {
    const counters = { discover: 0, headline: 0 };
    const deps = makeDeps(() => {}, counters);
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    expect(counters.discover).toBe(1);
    expect(counters.headline).toBe(1);
  });

  it("7-8. EditPlan headline comes from the dedicated result; bounds unchanged", async () => {
    const counters = { discover: 0, headline: 0 };
    const deps = makeDeps(() => {}, counters);
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.editPlan.headline).toBe("Delays Noted As Steps Turn Anticipatory");
      expect(result.editPlan.headline).not.toBe("Moment Title Sees Full Transcript");
      expect(result.editPlan.statementStart).toBeLessThanOrEqual(CLIP_START);
      expect(result.editPlan.statementEnd).toBe(CLIP_END);
    }
  });

  it("keeps one continuous interval when only CC filler flags exist", async () => {
    const counters = { discover: 0, headline: 0 };
    const transcript = {
      ...mockTranscript,
      words: mockTranscript.words.map((word, index) =>
        index === 7 ? { ...word, isFiller: true } : word,
      ),
    };
    const deps = {
      ...makeDeps(() => {}, counters),
      getExistingTranscript: async () => ({ success: true as const, data: transcript }),
    };
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.editPlan.keepIntervals).toHaveLength(1);
      expect(result.editPlan.keepIntervals?.[0].start).toBe(0);
      expect(result.editPlan.keepIntervals?.[0].end).toBeGreaterThan(0);
      expect(result.editPlan.keepIntervals?.[0].duration).toBeGreaterThan(0);
    }
  });

  it("fallback on headline failure is grounded, flagged for review", async () => {
    const counters = { discover: 0, headline: 0 };
    const deps = makeDeps(() => {}, counters, { success: false, error: "upstream 500" });
    const result = await runAutoProductionPlanning(brief, deps);
    expect(result.success).toBe(true);
    if (result.success) {
      // Deterministic fragment from the selected slice — no helicopters.
      expect(result.editPlan.headline.toLowerCase()).not.toContain("helicopter");
      expect(result.editPlan.headline.toLowerCase()).toContain("delays");
      expect(result.editPlan.headlineSignal.confidence).toBe("review");
    }
  });
});
