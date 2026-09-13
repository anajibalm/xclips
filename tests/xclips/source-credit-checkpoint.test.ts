import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveSourceCreditMeta } from "@/lib/xclips/auto-production-helpers";
import {
  buildPlanningCheckpoint,
  hashTranscriptWords,
  parseS6aArgs,
  resolveResumeContext,
  type PlanningCheckpoint,
} from "@/lib/xclips/e2e-checkpoint";
import type { RerenderJobContext } from "@/lib/xclips/auto-production-service";
import type { WordTimestamp } from "@/lib/xclips/types";

const words: WordTimestamp[] = [
  { word: "Uji", start: 0, end: 0.5 },
  { word: "coba", start: 0.5, end: 1.0 },
];

function contextFixture(): RerenderJobContext {
  return {
    brief: {
      source: { sourcePath: "/media/source.mp4", sourceType: "local" },
      editorialAngle: "angle",
      editorialFunction: "informasi publik",
      accountPresetId: "kabakom",
      sourceName: "Example Publisher",
      accountHandle: "@publisher",
      sensitiveContent: false,
      brollPool: [],
    },
    preset: {
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
    },
    editPlan: {
      statementStart: 1,
      statementEnd: 5,
      headline: "Judul uji",
      brollPlacements: [],
      statementSignal: { confidence: "strong", warnings: [] },
      brollSignal: { confidence: "strong", warnings: [] },
      headlineSignal: { confidence: "strong", warnings: [] },
    },
    transcriptWords: words,
    sourceVideoPath: "/media/source.mp4",
    sourceWidth: 1920,
    sourceHeight: 1080,
  };
}

describe("source credit domain separation", () => {
  test("output account handle is used as-is with a foreign footage source", () => {
    expect(
      resolveSourceCreditMeta({ channel: "Foreign Publisher", uploader: "Foreign Publisher" }, "Brief", "@bakom_ri"),
    ).toEqual({ sourceName: "Foreign Publisher", publisherHandle: "@bakom_ri" });
  });

  test("preserves explicit source name and handle", () => {
    expect(resolveSourceCreditMeta({ channel: "Display Name" }, "Brief", "@publisher")).toEqual({
      sourceName: "Display Name",
      publisherHandle: "@publisher",
    });
  });

  test("accountHandle @bakom_ri with footage source Official iNews", () => {
    expect(resolveSourceCreditMeta({ channel: "Official iNews", uploader: "Official iNews" }, "Brief", "@bakom_ri")).toEqual({
      sourceName: "Official iNews",
      publisherHandle: "@bakom_ri",
    });
  });

  test("blank handle with footage uploaderId is still missing", () => {
    expect(resolveSourceCreditMeta({ uploader: "Official iNews", uploaderId: "@officialinews" }, "Brief", "")).toEqual({
      error: "MISSING_PUBLISHER_HANDLE",
    });
  });

  test("blank handle with footage channelUrl is still missing", () => {
    expect(
      resolveSourceCreditMeta({ channel: "Display Name", channelUrl: "https://www.youtube.com/@publisher" }, "Brief", ""),
    ).toEqual({ error: "MISSING_PUBLISHER_HANDLE" });
  });

  test("valid handle is never overridden by footage metadata", () => {
    expect(
      resolveSourceCreditMeta(
        { channel: "Display Name", uploaderId: "@footage", channelUrl: "https://www.youtube.com/@footage" },
        "Brief",
        "@publisher",
      ),
    ).toEqual({ sourceName: "Display Name", publisherHandle: "@publisher" });
  });

  test("does not convert display name into handle", () => {
    expect(resolveSourceCreditMeta({ channel: "Official iNews" }, "Brief", "")).toEqual({
      error: "MISSING_PUBLISHER_HANDLE",
    });
  });

  test("rejects UC-style channel IDs as handles", () => {
    expect(resolveSourceCreditMeta({ channelId: "UCxxxxxxxxxxxxxxxxxxxxxx" }, "Brief", "")).toEqual({
      error: "MISSING_PUBLISHER_HANDLE",
    });
    expect(resolveSourceCreditMeta({ channel: "Some Channel", channelId: "UCxxxxxxxxxxxxxxxxxxxxxx" }, "Brief", "")).toEqual({
      error: "MISSING_PUBLISHER_HANDLE",
    });
  });

  test("footage uploaderId never becomes publisher handle", () => {
    expect(resolveSourceCreditMeta({ uploader: "Example Publisher", uploaderId: "@example" }, "Brief", "")).toEqual({
      error: "MISSING_PUBLISHER_HANDLE",
    });
  });
});

describe("s6a runner CLI parsing", () => {
  test("parses fresh source and output dir", () => {
    expect(parseS6aArgs(["bun", "scripts/s6a-e2e.ts", "/media/a.mp4", "artifacts/out"])).toEqual({
      mode: "fresh",
      sourcePath: "/media/a.mp4",
      outDir: "artifacts/out",
    });
  });

  test("parses resume checkpoint and output dir", () => {
    expect(parseS6aArgs(["bun", "scripts/s6a-e2e.ts", "--resume-planning", "artifacts/cp.json", "artifacts/out"])).toEqual({
      mode: "resume",
      checkpointPath: "artifacts/cp.json",
      outDir: "artifacts/out",
    });
  });

  test("never treats argv[0] as source path", () => {
    const parsed = parseS6aArgs(["bun", "scripts/s6a-e2e.ts", "--resume-planning", "artifacts/cp.json", "artifacts/out"]);
    if (parsed.mode !== "resume") throw new Error("expected resume mode");
    expect(parsed.checkpointPath).toBe("artifacts/cp.json");
    expect(parsed.checkpointPath).not.toBe("bun");
  });

  test("reports usage on empty args", () => {
    expect(parseS6aArgs(["bun", "scripts/s6a-e2e.ts"]).mode).toBe("error");
  });
});

describe("planning checkpoint resume", () => {
  function checkpointFixture(): PlanningCheckpoint {
    return buildPlanningCheckpoint({
      context: contextFixture(),
      projectId: "proj_1",
      transcriptId: "tr_1",
      provider: "openai",
      model: "openai/gpt-5.6-luna",
    });
  }

  const store = {
    getProject: () => ({ id: "proj_1", sourcePath: "/media/source.mp4" }) as never,
    getTranscript: () => ({ id: "tr_1", words }) as never,
  };

  test("checkpoint stores hash, not transcript words", () => {
    const raw = JSON.stringify(checkpointFixture());
    expect(raw).not.toContain("transcriptWords");
    expect(raw).not.toContain("\"context\"");
    expect(checkpointFixture().transcriptHash).toBe(hashTranscriptWords(words));
    expect(checkpointFixture().transcriptWordCount).toBe(2);
  });

  test("checkpoint stores no API key", () => {
    const raw = JSON.stringify(checkpointFixture());
    expect(raw).not.toContain("apiKey");
  });

  test("resume rebuilds context from DB without AI", () => {
    const context = resolveResumeContext(checkpointFixture(), store);
    expect(context.sourceVideoPath).toBe("/media/source.mp4");
    expect(context.transcriptWords).toEqual(words);
    expect(context.editPlan.headline).toBe("Judul uji");
  });

  test("rejects source mismatch", () => {
    const cp = { ...checkpointFixture(), sourcePath: "/media/other.mp4" };
    expect(() => resolveResumeContext(cp, store)).toThrow("PLANNING_SOURCE_MISMATCH");
  });

  test("rejects project mismatch", () => {
    const badStore = {
      getProject: () => null,
      getTranscript: () => ({ id: "tr_1", words }) as never,
    };
    expect(() => resolveResumeContext(checkpointFixture(), badStore)).toThrow("PLANNING_SOURCE_MISMATCH");
  });

  test("rejects transcript mismatch", () => {
    const badStore = {
      getProject: () => ({ id: "proj_1", sourcePath: "/media/source.mp4" }) as never,
      getTranscript: () => ({ id: "tr_1", words: [{ word: "lain", start: 0, end: 1 }] }) as never,
    };
    expect(() => resolveResumeContext(checkpointFixture(), badStore)).toThrow("PLANNING_TRANSCRIPT_MISMATCH");
  });

  test("rejects malformed checkpoint", () => {
    expect(() => resolveResumeContext(null, store)).toThrow("INVALID_PLANNING_CHECKPOINT");
    expect(() => resolveResumeContext({ schemaVersion: "wrong" }, store)).toThrow("INVALID_PLANNING_CHECKPOINT");
  });
});

describe("no fixture leakage in production code", () => {
  test("credit/checkpoint/render code contains no fixture identity", () => {
    const files = [
      "src/lib/xclips/auto-production-helpers.ts",
      "src/lib/xclips/e2e-checkpoint.ts",
      "src/lib/xclips/auto-production-service.ts",
      "src/lib/xclips/ytdlp-downloader.ts",
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const fixture of ["NOsnlK5VxI0", "Qodari", "Official iNews", "Rakber"]) {
        expect(content.includes(fixture)).toBe(false);
      }
    }
  });
});
