import { describe, expect, test } from "bun:test";
import * as path from "path";
import { normalizeUploadDate } from "@/lib/xclips/ytdlp-downloader";
import { isValidIsoDate, resolveBriefSourceDate } from "@/lib/xclips/auto-production-helpers";
import { runAutoProductionQc } from "@/lib/xclips/auto-production-qc";
import {
  runAutoProductionPlanning,
  type AutoProductionDeps,
} from "@/lib/xclips/auto-production-orchestrator";
import type { ProductionBrief } from "@/lib/xclips/auto-production-types";
import type { WordTimestamp } from "@/lib/xclips/types";

const FIXTURE_VIDEO = path.resolve(process.cwd(), "vault", "xclips", "test-fixtures", "auto-prod-smoke.mp4");

function timed(text: string, stepSec = 0.9): WordTimestamp[] {
  return text.split(/\s+/).map((word, i) => ({
    word,
    start: i * stepSec,
    end: (i + 1) * stepSec,
  }));
}

function makeDeps(options: {
  words: WordTimestamp[];
  candidate: { startSec: number; endSec: number };
  aiHeadline: string;
}): AutoProductionDeps {
  const project: never = {
    id: "proj_qc_001",
    name: "QC closure fixture",
    sourceType: "local",
    sourcePath: "/tmp/qc-closure.mp4",
    durationSec: 120,
    width: 1920,
    height: 1080,
    frameRate: 30,
    isVfr: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as never;
  const transcript: never = {
    id: "tr_qc_001",
    projectId: "proj_qc_001",
    label: "fixture",
    sourceType: "ai",
    isActive: true,
    language: "id",
    rawText: options.words.map((w) => w.word).join(" "),
    srtContent: "",
    words: options.words,
    createdAt: "2026-01-01T00:00:00.000Z",
  } as never;
  return {
    ingestLocalFile: async () => ({ success: true, data: project }),
    ingestYouTubeUrl: async () => ({ success: true, data: project }),
    getExistingTranscript: async () => ({ success: true, data: transcript }),
    transcribeProject: async () => ({ success: true, data: transcript }),
    discoverHighlights: async () => ({
      success: true,
      data: [
        {
          id: "clip_qc_001",
          projectId: "proj_qc_001",
          transcriptId: "tr_qc_001",
          title: "Kandidat",
          hookText: "Kait",
          viralScore: 80,
          startSec: options.candidate.startSec,
          endSec: options.candidate.endSec,
          aspectRatio: "9:16",
          layoutMode: "blur_bg",
          panOffsetX: 0,
          subtitleStyle: {},
          removeFillers: true,
          removeSilence: true,
          customCuts: [],
          status: "draft",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
    generateHeadline: async () => ({ success: true, data: { headline: options.aiHeadline } }),
  } as unknown as AutoProductionDeps;
}

function makeBrief(): ProductionBrief {
  return {
    source: { sourcePath: "/tmp/qc-closure.mp4", sourceType: "local" },
    editorialAngle: "Sudut uji generik",
    editorialFunction: "informasi publik",
    accountPresetId: "shadow",
    sourceName: "Sumber Uji",
    accountHandle: "@uji",
    sensitiveContent: false,
    brollPool: [],
  };
}

function makeQcBrief(overrides?: Partial<ProductionBrief>): ProductionBrief {
  return {
    source: { sourcePath: FIXTURE_VIDEO, sourceType: "local" },
    editorialAngle: "Sudut uji generik",
    editorialFunction: "informasi publik",
    accountPresetId: "shadow",
    sourceName: "Sumber Uji",
    accountHandle: "@uji",
    brollPool: [],
    ...overrides,
  };
}

describe("platform source date closure", () => {
  test("valid YYYYMMDD normalizes to ISO", () => {
    expect(normalizeUploadDate("20260210")).toBe("2026-02-10");
  });

  test("invalid or missing values stay undefined", () => {
    expect(normalizeUploadDate("20261345")).toBeUndefined();
    expect(normalizeUploadDate("20260230")).toBeUndefined();
    expect(normalizeUploadDate("10-02-2026")).toBeUndefined();
    expect(normalizeUploadDate("")).toBeUndefined();
    expect(normalizeUploadDate(undefined)).toBeUndefined();
    expect(normalizeUploadDate(null)).toBeUndefined();
    expect(normalizeUploadDate(20260210)).toBeUndefined();
  });

  test("ISO validator rejects impossible calendar dates", () => {
    expect(isValidIsoDate("2026-02-10")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-2-1")).toBe(false);
    expect(isValidIsoDate("10-02-2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });

  test("valid explicit operator date wins with operator provenance", () => {
    expect(resolveBriefSourceDate("2026-01-05", "2026-02-10")).toEqual({ date: "2026-01-05", provenance: "operator" });
    expect(resolveBriefSourceDate(" 2026-01-05 ", "2026-02-10")).toEqual({ date: "2026-01-05", provenance: "operator" });
  });

  test("invalid explicit date falls back to valid platform date", () => {
    expect(resolveBriefSourceDate("10-01-2026", "2026-02-10")).toEqual({ date: "2026-02-10", provenance: "platform_upload" });
    expect(resolveBriefSourceDate("2026-13-45", "2026-02-10")).toEqual({ date: "2026-02-10", provenance: "platform_upload" });
    expect(resolveBriefSourceDate("", "2026-02-10")).toEqual({ date: "2026-02-10", provenance: "platform_upload" });
    expect(resolveBriefSourceDate(undefined, "2026-02-10")).toEqual({ date: "2026-02-10", provenance: "platform_upload" });
  });

  test("both invalid or missing yields missing provenance", () => {
    expect(resolveBriefSourceDate("", "")).toEqual({ provenance: "missing" });
    expect(resolveBriefSourceDate(undefined, undefined)).toEqual({ provenance: "missing" });
    expect(resolveBriefSourceDate("bogus", "also-bogus")).toEqual({ provenance: "missing" });
    expect(resolveBriefSourceDate(undefined, null)).toEqual({ provenance: "missing" });
  });

  test("QC PASS message shows provenance without claiming event date", async () => {
    const qc = await runAutoProductionQc({
      outputPath: FIXTURE_VIDEO,
      brief: makeQcBrief({ sourceDate: "2026-02-10", sourceDateProvenance: "platform_upload" }),
      preset: (await import("@/lib/xclips/auto-production-types")).ACCOUNT_PRESETS.get("shadow")!,
      editPlan: {
        statementStart: 5,
        statementEnd: 35,
        headline: "Judul uji",
        brollPlacements: [],
        statementSignal: { confidence: "strong", warnings: [] },
        brollSignal: { confidence: "strong", warnings: [] },
        headlineSignal: { confidence: "strong", warnings: [] },
      },
      renderWidth: 1080,
      renderHeight: 1920,
      renderFps: 30,
      renderDurationSec: 30,
    });
    const check = qc.checks.find((c) => c.id === "contract_source_date");
    expect(check?.status).toBe("PASS");
    expect(check?.message).toContain("platform_upload");
    expect(check?.message).toContain("not the event date");
  });

  test("QC REVIEW when no valid date exists", async () => {
    const qc = await runAutoProductionQc({
      outputPath: FIXTURE_VIDEO,
      brief: makeQcBrief({ sourceDate: undefined, sourceDateProvenance: "missing" }),
      preset: (await import("@/lib/xclips/auto-production-types")).ACCOUNT_PRESETS.get("shadow")!,
      editPlan: {
        statementStart: 5,
        statementEnd: 35,
        headline: "Judul uji",
        brollPlacements: [],
        statementSignal: { confidence: "strong", warnings: [] },
        brollSignal: { confidence: "strong", warnings: [] },
        headlineSignal: { confidence: "strong", warnings: [] },
      },
      renderWidth: 1080,
      renderHeight: 1920,
      renderFps: 30,
      renderDurationSec: 30,
    });
    expect(qc.checks.find((c) => c.id === "contract_source_date")?.status).toBe("REVIEW");
  });
});

describe("headline grounding closure", () => {
  const words = timed("Presiden memimpin rapat terbatas hari ini");

  test("grounded AI headline is kept", async () => {
    const result = await runAutoProductionPlanning(
      makeBrief(),
      makeDeps({ words, candidate: { startSec: 0, endSec: 5.4 }, aiHeadline: "Presiden Memimpin Rapat Terbatas" }),
    );
    if (!result.success) throw new Error(`planning failed: ${result.error}`);
    expect(result.editPlan.headline).toBe("Presiden Memimpin Rapat Terbatas");
    expect(result.editPlan.headlineSignal.confidence).toBe("strong");
  });

  test("ungrounded AI headline falls back to extractive transcript slice", async () => {
    const result = await runAutoProductionPlanning(
      makeBrief(),
      makeDeps({ words, candidate: { startSec: 0, endSec: 5.4 }, aiHeadline: "Laporan Rahasia Istana Terbongkar" }),
    );
    if (!result.success) throw new Error(`planning failed: ${result.error}`);
    expect(result.editPlan.headline).toBe("Presiden memimpin rapat terbatas hari ini");
    expect(result.editPlan.headlineSignal.confidence).toBe("strong");
    expect(result.editPlan.headlineSignal.warnings.join(" ")).toContain("extractive fallback");
  });

  test("empty fallback keeps REVIEW with the AI headline", async () => {
    const short = timed("Halo dunia");
    const result = await runAutoProductionPlanning(
      makeBrief(),
      makeDeps({ words: short, candidate: { startSec: 0, endSec: 1.8 }, aiHeadline: "Skandal Xyzzy Terbongkar" }),
    );
    if (!result.success) throw new Error(`planning failed: ${result.error}`);
    expect(result.editPlan.headline).toBe("Skandal Xyzzy Terbongkar");
    expect(result.editPlan.headlineSignal.confidence).toBe("review");
  });
});
