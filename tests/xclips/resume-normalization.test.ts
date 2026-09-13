import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyResumeOptions,
  buildPlanningCheckpoint,
  parseS6aArgs,
  resolveResumeContext,
} from "@/lib/xclips/e2e-checkpoint";
import type { RerenderJobContext } from "@/lib/xclips/auto-production-service";
import type { WordTimestamp } from "@/lib/xclips/types";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error("network must not be used in resume normalization tests");
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function timed(text: string, stepSec = 0.9): WordTimestamp[] {
  return text.split(/\s+/).map((word, i) => ({ word, start: i * stepSec, end: (i + 1) * stepSec }));
}

const PRESET: RerenderJobContext["preset"] = {
  id: "kabakom",
  label: "Kabakom",
  width: 1080,
  height: 1920,
  fps: 30,
  captionStyle: {
    fontFamily: "Inter",
    fontSizePx: 44,
    color: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthPx: 2,
    uppercase: true,
    maxWordsPerPhrase: 6,
  },
  headlineStyle: { fontFamily: "Inter", fontSizePx: 52, color: "#FFFFFF", position: "top" },
  safeZone: { topPx: 120, bottomPx: 120, leftPx: 48, rightPx: 48 },
  sourceCreditPlacement: "bottom_left",
  handlePlacement: "bottom_right",
  transition: "hard_cut",
  loudnessTargetLu: -14,
  bgmPolicy: { enabled: false },
};

function makeContext(overrides?: {
  headline?: string;
  headlineSignal?: RerenderJobContext["editPlan"]["headlineSignal"];
  brief?: Partial<RerenderJobContext["brief"]>;
  words?: WordTimestamp[];
}): { context: RerenderJobContext; words: WordTimestamp[] } {
  const words = overrides?.words ?? timed("Presiden memimpin rapat terbatas hari ini");
  const context: RerenderJobContext = {
    brief: {
      source: { sourcePath: "/media/source.mp4", sourceType: "local" },
      editorialAngle: "angle",
      editorialFunction: "informasi publik",
      accountPresetId: "kabakom",
      sourceName: "Example Publisher",
      accountHandle: "@publisher",
      sensitiveContent: false,
      brollPool: [],
      ...overrides?.brief,
    },
    preset: PRESET,
    editPlan: {
      statementStart: 0,
      statementEnd: 5.4,
      headline: overrides?.headline ?? "Presiden Memimpin Rapat Terbatas",
      brollPlacements: [],
      statementSignal: { confidence: "strong", warnings: [] },
      brollSignal: { confidence: "strong", warnings: [] },
      headlineSignal: overrides?.headlineSignal ?? { confidence: "strong", warnings: [] },
    },
    transcriptWords: words,
    sourceVideoPath: "/media/source.mp4",
    sourceWidth: 1920,
    sourceHeight: 1080,
  };
  return { context, words };
}

const PROJECT = { sourceMeta: {} } as never;

describe("resume CLI", () => {
  test("parses full resume form with flags in any order", () => {
    expect(
      parseS6aArgs(["bun", "s.ts", "--resume-planning", "cp.json", "--confirm-context", "--source-date", "2026-02-10", "out"]),
    ).toEqual({ mode: "resume", checkpointPath: "cp.json", outDir: "out", confirmContext: true, sourceDate: "2026-02-10" });
    expect(
      parseS6aArgs(["bun", "s.ts", "--source-date", "2026-02-10", "--resume-planning", "cp.json", "out"]),
    ).toEqual({ mode: "resume", checkpointPath: "cp.json", outDir: "out", confirmContext: false, sourceDate: "2026-02-10" });
  });

  test("invalid source date fails before render", () => {
    const parsed = parseS6aArgs(["bun", "s.ts", "--resume-planning", "cp.json", "--source-date", "kemarin", "out"]);
    expect(parsed.mode).toBe("error");
    if (parsed.mode === "error") expect(parsed.error).toContain("INVALID_SOURCE_DATE");
  });

  test("unknown flag is rejected", () => {
    const parsed = parseS6aArgs(["bun", "s.ts", "--resume-planning", "cp.json", "--turbo", "out"]);
    expect(parsed.mode).toBe("error");
  });

  test("operator flags require resume mode", () => {
    expect(parseS6aArgs(["bun", "s.ts", "/media/a.mp4", "out", "--confirm-context"]).mode).toBe("error");
    expect(parseS6aArgs(["bun", "s.ts", "--source-date", "2026-02-10", "/media/a.mp4", "out"]).mode).toBe("error");
  });

  test("legacy forms still parse", () => {
    expect(parseS6aArgs(["bun", "s.ts", "/media/a.mp4", "out"])).toEqual({ mode: "fresh", sourcePath: "/media/a.mp4", outDir: "out" });
    expect(parseS6aArgs(["bun", "s.ts", "--resume-planning", "cp.json", "out"])).toEqual({
      mode: "resume",
      checkpointPath: "cp.json",
      outDir: "out",
      confirmContext: false,
    });
  });
});

describe("applyResumeOptions", () => {
  test("without confirm-context, attestation stays undefined", () => {
    const { context, words } = makeContext();
    const out = applyResumeOptions(context, PROJECT, words, {});
    expect(out.brief.contextIntegrityConfirmed).toBeUndefined();
    expect(out.brief).toEqual({ ...context.brief, sourceDate: undefined, sourceDateProvenance: "missing" });
  });

  test("confirm-context sets only the attestation", () => {
    const { context, words } = makeContext();
    const out = applyResumeOptions(context, PROJECT, words, { confirmContext: true });
    expect(out.brief.contextIntegrityConfirmed).toBe(true);
    expect(out.editPlan).toEqual(context.editPlan);
    expect(out.sourceVideoPath).toBe(context.sourceVideoPath);
  });

  test("explicit source date wins with operator provenance", () => {
    const { context, words } = makeContext();
    const out = applyResumeOptions(context, PROJECT, words, { sourceDate: "2026-02-10" });
    expect(out.brief.sourceDate).toBe("2026-02-10");
    expect(out.brief.sourceDateProvenance).toBe("operator");
  });

  test("invalid explicit source date throws before render", () => {
    const { context, words } = makeContext();
    expect(() => applyResumeOptions(context, PROJECT, words, { sourceDate: "kemarin" })).toThrow("INVALID_SOURCE_DATE");
  });

  test("platform upload date used with platform provenance", () => {
    const { context, words } = makeContext();
    const out = applyResumeOptions(
      context,
      { sourceMeta: { uploadDate: "2026-02-10" } } as never,
      words,
      {},
    );
    expect(out.brief.sourceDate).toBe("2026-02-10");
    expect(out.brief.sourceDateProvenance).toBe("platform_upload");
  });

  test("both empty stays missing", () => {
    const { context, words } = makeContext();
    const out = applyResumeOptions(context, PROJECT, words, {});
    expect(out.brief.sourceDate).toBeUndefined();
    expect(out.brief.sourceDateProvenance).toBe("missing");
  });

  test("grounded headline untouched", () => {
    const { context, words } = makeContext();
    const out = applyResumeOptions(context, PROJECT, words, {});
    expect(out.editPlan.headline).toBe("Presiden Memimpin Rapat Terbatas");
    expect(out.editPlan.headlineSignal).toEqual({ confidence: "strong", warnings: [] });
  });

  test("ungrounded headline takes validated extractive fallback", () => {
    const { context, words } = makeContext({
      headline: "Laporan Rahasia Istana Terbongkar",
      headlineSignal: { confidence: "review", warnings: ["old"] },
    });
    const out = applyResumeOptions(context, PROJECT, words, {});
    expect(out.editPlan.headline).toBe("Presiden memimpin rapat terbatas hari ini");
    expect(out.editPlan.headlineSignal.confidence).toBe("strong");
    expect(out.editPlan.headlineSignal.warnings.join(" ")).toContain("extractive fallback");
  });

  test("failed fallback keeps old headline in review", () => {
    const short = timed("Halo dunia");
    const { context } = makeContext({
      headline: "Skandal Xyzzy Terbongkar",
      headlineSignal: { confidence: "review", warnings: ["old"] },
      words: short,
    });
    const out = applyResumeOptions(context, PROJECT, short, {});
    expect(out.editPlan.headline).toBe("Skandal Xyzzy Terbongkar");
    expect(out.editPlan.headlineSignal.confidence).toBe("review");
  });
});

describe("checkpoint file stability", () => {
  test("normalization never rewrites the checkpoint file", () => {
    const { context, words } = makeContext({
      headline: "Laporan Rahasia Istana Terbongkar",
      headlineSignal: { confidence: "review", warnings: [] },
    });
    const dir = mkdtempSync(join(tmpdir(), "s6a-resume-"));
    const file = join(dir, "planning-result.json");
    const checkpoint = buildPlanningCheckpoint({
      context,
      projectId: "proj_1",
      transcriptId: "tr_1",
      provider: "openai",
      model: "openai/gpt-5.6-luna",
    });
    writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);
    const before = readFileSync(file, "utf8");
    const store = {
      getProject: () => ({ id: "proj_1", sourcePath: "/media/source.mp4" }) as never,
      getTranscript: () => ({ id: "tr_1", words }) as never,
    };
    const resolved = resolveResumeContext(JSON.parse(before), store);
    applyResumeOptions(resolved, { sourceMeta: {} } as never, words, { confirmContext: true });
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  test("tampered transcript still rejected", () => {
    const { context, words } = makeContext();
    const checkpoint = buildPlanningCheckpoint({
      context,
      projectId: "proj_1",
      transcriptId: "tr_1",
      provider: "openai",
      model: "openai/gpt-5.6-luna",
    });
    const store = {
      getProject: () => ({ id: "proj_1", sourcePath: "/media/source.mp4" }) as never,
      getTranscript: () => ({ id: "tr_1", words: timed("kata lain di sini") }) as never,
    };
    expect(() => resolveResumeContext(checkpoint, store)).toThrow("PLANNING_TRANSCRIPT_MISMATCH");
    expect(words.length).toBeGreaterThan(0);
  });
});
